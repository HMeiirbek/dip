import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import chatSocketService from '../services/chatSocket';
import { ChatListItem, ChatMessageItem, User } from '../types';
import s from './ChatsPanel.module.css';

const MOBILE_BP = '(max-width: 720px)';

export const ChatsPanel: React.FC<{
  currentUser: User;
  accessToken: string;
}> = ({ currentUser, accessToken }) => {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ users: User[]; groups: any[] } | null>(null);
  const [error, setError] = useState('');
  const [typingState, setTypingState] = useState<Record<string, Set<string>>>({});
  const [newMemberId, setNewMemberId] = useState('');
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');
  const isMobile = useMediaQuery(MOBILE_BP);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId],
  );

  const lastTypingSentRef = useRef(0);

  const loadChats = useCallback(async (targetChatId?: string | null) => {
    try {
      const data = await apiService.listChats();
      setChats(data);
      const nextActive = targetChatId || activeChatId || data[0]?.id || null;
      if (nextActive && nextActive !== activeChatId) {
        setActiveChatId(nextActive);
      }
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  }, [activeChatId]);

  const loadMessages = async (chatId: string) => {
    try {
      const data = await apiService.getChatMessages(chatId);
      setMessages(data);
      const last = data[data.length - 1];
      if (last?.id) {
        try {
          await apiService.markChatRead(chatId, last.id);
        } catch {}
      }
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!isMobile) setMobilePane('list');
  }, [isMobile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        chatSocketService.disconnect();
        await chatSocketService.connect(accessToken);
        if (!mounted) return;
      } catch (e) {
        setError(`Chat socket: ${getAxiosErrorMessage(e)}`);
      }
    })();
    return () => {
      mounted = false;
      chatSocketService.disconnect();
    };
  }, [accessToken]);

  useEffect(() => {
    if (!activeChatId) return;
    chatSocketService.join(activeChatId);
    loadMessages(activeChatId);

    return () => {
      chatSocketService.leave(activeChatId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  useEffect(() => {
    const onMsg = (payload: { chatId: string; message: any }) => {
      if (payload.chatId !== activeChatId) {
        loadChats(activeChatId);
        return;
      }
      setMessages((prev) => [...prev, payload.message as ChatMessageItem]);
      loadChats(activeChatId);
    };

    const onTyping = (payload: { chatId: string; userId: string; isTyping: boolean }) => {
      if (payload.chatId !== activeChatId) return;
      if (payload.userId === currentUser.id) return;
      setTypingState((prev) => {
        const next = { ...prev };
        const set = new Set(next[payload.chatId] || []);
        if (payload.isTyping) set.add(payload.userId);
        else set.delete(payload.userId);
        next[payload.chatId] = set;
        return next;
      });
    };

    chatSocketService.onMessage(onMsg);
    chatSocketService.onTyping(onTyping);
    return () => {
      chatSocketService.offMessage(onMsg);
      chatSocketService.offTyping(onTyping);
    };
  }, [activeChatId, currentUser.id, loadChats]);

  const doSearch = async () => {
    const term = q.trim();
    if (term.length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await apiService.searchChats(term);
      setSearchResults(res);
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const isGroupChat = activeChat?.type === 'GROUP';
  const isGroupOwner = Boolean(isGroupChat && activeChat?.ownerId === currentUser.id);

  const addGroupMember = async () => {
    if (!activeChatId || !newMemberId.trim()) return;
    try {
      await apiService.addChatMember(activeChatId, newMemberId.trim());
      setNewMemberId('');
      await loadChats(activeChatId);
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const removeGroupMember = async (userId: string) => {
    if (!activeChatId) return;
    try {
      await apiService.removeChatMember(activeChatId, userId);
      await loadChats(activeChatId);
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const startPrivateChat = async (userId: string) => {
    try {
      const chat = await apiService.createChat({
        type: 'PRIVATE',
        memberIds: [userId],
      });
      await loadChats();
      setActiveChatId(chat.id);
      setSearchResults(null);
      setQ('');
      if (isMobile) setMobilePane('chat');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const addUserToGroupDraft = (u: User) => {
    if (u.id === currentUser.id) return;
    setGroupMembers((prev) => (prev.some((m) => m.id === u.id) ? prev : [...prev, u]));
  };

  const removeUserFromGroupDraft = (id: string) => {
    setGroupMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const cancelCreateGroup = () => {
    setCreateGroupOpen(false);
    setGroupTitle('');
    setGroupMembers([]);
  };

  const submitCreateGroup = async () => {
    const title = groupTitle.trim();
    if (!title || groupMembers.length === 0) return;
    try {
      const chat = await apiService.createChat({
        type: 'GROUP',
        title,
        memberIds: groupMembers.map((m) => m.id),
      });
      cancelCreateGroup();
      setSearchResults(null);
      setQ('');
      await loadChats(chat.id);
      setActiveChatId(chat.id);
      if (isMobile) setMobilePane('chat');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    if (isMobile) setMobilePane('chat');
  };

  const goBackToList = () => {
    setMobilePane('list');
  };

  const send = async () => {
    if (!activeChatId) return;
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    chatSocketService.send(activeChatId, content);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!activeChatId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 900) {
      lastTypingSentRef.current = now;
      chatSocketService.typing(activeChatId, value.trim().length > 0);
    }
  };

  const typingUsers = activeChatId ? Array.from(typingState[activeChatId] || []) : [];

  const rootClass = [
    s.root,
    isMobile && mobilePane === 'list' ? s.mobileShowList : '',
    isMobile && mobilePane === 'chat' ? s.mobileShowChat : '',
  ]
    .filter(Boolean)
    .join(' ');

  const canCreateGroup = groupTitle.trim().length > 0 && groupMembers.length > 0;

  return (
    <div className={rootClass}>
      <div className={s.left}>
        <div className={s.toolbar}>
          {!createGroupOpen ? (
            <button type="button" className={s.primaryToolbar} onClick={() => setCreateGroupOpen(true)}>
              New group
            </button>
          ) : (
            <button type="button" className={s.secondaryToolbar} onClick={cancelCreateGroup}>
              Cancel
            </button>
          )}
        </div>

        {createGroupOpen ? (
          <div className={s.createGroupPanel}>
            <div className={s.createGroupTitle}>New group</div>
            <input
              className={s.searchInput}
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name"
              maxLength={120}
            />
            <div className={s.createGroupHint}>Add at least one member via search below, then create.</div>
            {groupMembers.length ? (
              <div className={s.chipRow}>
                {groupMembers.map((m) => (
                  <span key={m.id} className={s.chip}>
                    @{m.username}
                    <button type="button" className={s.chipRemove} onClick={() => removeUserFromGroupDraft(m.id)} aria-label={`Remove ${m.username}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <button type="button" className={s.button} disabled={!canCreateGroup} onClick={submitCreateGroup}>
              Create group
            </button>
          </div>
        ) : null}

        <div className={s.searchRow}>
          <input
            className={s.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search @username or group..."
          />
          <button type="button" className={s.button} onClick={doSearch}>
            Search
          </button>
        </div>

        {searchResults && (
          <div className={s.searchResults}>
            <div className={s.sectionTitle}>Users</div>
            {searchResults.users.map((u) =>
              createGroupOpen && u.id !== currentUser.id ? (
                <div key={u.id} className={s.resultRow}>
                  <div className={s.resultItemGrow}>
                    <span className={s.resultTitle}>@{u.username}</span>
                    {u.name ? <span className={s.resultMeta}>{u.name}</span> : null}
                  </div>
                  <button
                    type="button"
                    className={s.resultAction}
                    disabled={groupMembers.some((m) => m.id === u.id)}
                    onClick={() => addUserToGroupDraft(u)}
                  >
                    {groupMembers.some((m) => m.id === u.id) ? 'Added' : 'Add'}
                  </button>
                  <button type="button" className={s.resultActionSecondary} onClick={() => startPrivateChat(u.id)}>
                    DM
                  </button>
                </div>
              ) : (
                <button key={u.id} type="button" className={s.resultItem} onClick={() => startPrivateChat(u.id)}>
                  <span className={s.resultTitle}>@{u.username}</span>
                  {u.name ? <span className={s.resultMeta}>{u.name}</span> : null}
                </button>
              ),
            )}
            <div className={s.sectionTitle}>Groups</div>
            {searchResults.groups.map((g: any) => (
              <button key={g.id} type="button" className={s.resultItem} onClick={() => selectChat(g.id)}>
                <span className={s.resultTitle}>{g.title || 'Group'}</span>
                <span className={s.resultMeta}>updated {new Date(g.updatedAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        <div className={s.chatList}>
          {chats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={[s.chatItem, c.id === activeChatId ? s.chatItemActive : ''].filter(Boolean).join(' ')}
              onClick={() => selectChat(c.id)}
            >
              <div className={s.chatTitleRow}>
                <span className={s.chatTitle}>{c.title || '(untitled)'}</span>
                {c.unreadCount > 0 ? <span className={s.badge}>{c.unreadCount}</span> : null}
              </div>
              {c.lastMessage ? (
                <>
                  <div className={s.chatPreview}>
                    {c.lastMessage.content.length > 80 ? c.lastMessage.content.slice(0, 80) + '…' : c.lastMessage.content}
                  </div>
                  <div className={s.chatLastTime}>{new Date(c.lastMessage.createdAt).toLocaleString()}</div>
                </>
              ) : (
                <div className={s.chatPreviewEmpty}>No messages yet</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={s.right}>
        <div className={s.header}>
          {isMobile && mobilePane === 'chat' ? (
            <button type="button" className={s.backButton} onClick={goBackToList}>
              ← Chats
            </button>
          ) : null}
          <div className={s.headerMain}>
            <div className={s.headerTitle}>{activeChat?.title || 'Select a chat'}</div>
            {typingUsers.length ? <div className={s.headerMeta}>typing…</div> : null}
          </div>
        </div>

        {isGroupChat && activeChat ? (
          <div className={s.groupMembers}>
            <div className={s.sectionTitle}>Members</div>
            <div className={s.memberList}>
              {activeChat.members.map((m) => {
                const canRemove =
                  (isGroupOwner && m.id !== currentUser.id) || m.id === currentUser.id;
                return (
                  <div key={m.id} className={s.memberRow}>
                    <span>
                      @{m.username}
                      {m.id === activeChat.ownerId ? <span className={s.ownerBadge}>owner</span> : null}
                    </span>
                    {canRemove ? (
                      <button
                        type="button"
                        className={s.smallButton}
                        onClick={() => removeGroupMember(m.id)}
                      >
                        {m.id === currentUser.id ? 'Leave' : 'Remove'}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {isGroupOwner ? (
              <div className={s.addMemberRow}>
                <input
                  className={s.memberInput}
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                  placeholder="Add member: user UUID"
                />
                <button type="button" className={s.button} onClick={addGroupMember}>
                  Add
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <div className={s.error}>{error}</div> : null}

        <div className={s.messages}>
          {messages.map((m) => {
            const mine = m.senderId === currentUser.id;
            return (
              <div key={m.id} className={[s.msgRow, mine ? s.msgRowMine : s.msgRowOther].join(' ')}>
                <div className={[s.msgBubble, mine ? s.msgMine : s.msgOther].join(' ')}>
                  <div className={s.msgText}>{m.content}</div>
                  <div className={s.msgMeta}>{new Date(m.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={s.composer}>
          <input
            className={s.composerInput}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Write a message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            disabled={!activeChatId}
          />
          <button className={s.button} onClick={send} disabled={!activeChatId}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

