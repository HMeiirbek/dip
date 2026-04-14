import React, { useEffect, useMemo, useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import { PrivacySettings, User } from '../types';
import s from './UserPage.module.css';

type TabKey = 'calls' | 'security' | 'risk' | 'chats' | 'support' | 'moderator' | 'admin';

export const UserDrawer: React.FC<{
  open: boolean;
  user: User;
  onClose: () => void;
  onLogout: () => Promise<void> | void;
  onRefreshAuth: () => Promise<void> | void;
  onReloadProfile?: () => Promise<void> | void;
  onNavigate: (tab: TabKey) => void;
}> = ({ open, user, onClose, onLogout, onRefreshAuth, onReloadProfile, onNavigate }) => {
  const isMobile = useMediaQuery('(max-width: 840px)');
  const [profileDraft, setProfileDraft] = useState<{ name: string; username: string; avatarUrl: string }>({
    name: user.name || '',
    username: user.username || '',
    avatarUrl: user.avatarUrl || '',
  });
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [contacts, setContacts] = useState<
    Array<{
      id: string;
      contactUserId: string;
      createdAt: string;
      contactUser: { id: string; username: string; name?: string | null; avatarUrl?: string | null };
    }>
  >([]);
  const [contactUserId, setContactUserId] = useState('');
  const [blockUserId, setBlockUserId] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<'password' | 'code'>('password');
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const initials = useMemo(() => {
    const name = (user.username || '').trim();
    if (!name) return 'U';
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    const first = parts[0]?.[0] || name[0];
    const second = parts.length > 1 ? parts[1]?.[0] : name[1];
    return (first + (second || '')).toUpperCase();
  }, [user.username]);

  const roleLabel = user.role || 'user';
  const verified = Boolean(user.verified);

  useEffect(() => {
    if (!open) return;
    setProfileDraft({
      name: user.name || '',
      username: user.username || '',
      avatarUrl: user.avatarUrl || '',
    });
  }, [open, user.avatarUrl, user.name, user.username]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const p = await apiService.getMyPrivacy();
        setPrivacy(p);
        const bl = await apiService.getMyBlacklist();
        setBlacklist(bl);
        try {
          const ct = await apiService.getMyContacts();
          setContacts(ct);
        } catch {
          setContacts([]);
        }
      } catch (e) {
        setError(getAxiosErrorMessage(e));
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const saveProfile = async () => {
    setNotice('');
    setError('');
    try {
      await apiService.updateMyProfile({
        name: profileDraft.name || undefined,
        username: profileDraft.username || undefined,
        avatarUrl: profileDraft.avatarUrl || undefined,
      });
      if (onReloadProfile) {
        await onReloadProfile();
      }
      setNotice('Profile updated');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const uploadAvatar = async (file: File) => {
    setNotice('');
    setError('');
    setAvatarUploading(true);
    try {
      await apiService.uploadMyAvatar(file);
      if (onReloadProfile) {
        await onReloadProfile();
      }
      setNotice('Avatar uploaded');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    } finally {
      setAvatarUploading(false);
    }
  };

  const savePrivacy = async () => {
    if (!privacy) return;
    setNotice('');
    setError('');
    try {
      const updated = await apiService.updateMyPrivacy({ allowMessagesFrom: privacy.allowMessagesFrom });
      setPrivacy(updated);
      if (onReloadProfile) {
        await onReloadProfile();
      }
      setNotice('Privacy updated');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const blockUser = async () => {
    setNotice('');
    setError('');
    try {
      const id = blockUserId.trim();
      if (!id) return;
      await apiService.addToMyBlacklist(id);
      setBlockUserId('');
      const bl = await apiService.getMyBlacklist();
      setBlacklist(bl);
      setNotice('User blocked');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const addContact = async () => {
    setNotice('');
    setError('');
    try {
      const id = contactUserId.trim();
      if (!id) return;
      await apiService.addMyContact(id);
      setContactUserId('');
      const ct = await apiService.getMyContacts();
      setContacts(ct);
      setNotice('Contact added');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const removeContact = async (uid: string) => {
    setNotice('');
    setError('');
    try {
      await apiService.removeMyContact(uid);
      const ct = await apiService.getMyContacts();
      setContacts(ct);
      setNotice('Contact removed');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const unblockUser = async (blockedUserId: string) => {
    setNotice('');
    setError('');
    try {
      await apiService.removeFromMyBlacklist(blockedUserId);
      const bl = await apiService.getMyBlacklist();
      setBlacklist(bl);
      setNotice('User unblocked');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const changePassword = async () => {
    setNotice('');
    setError('');
    try {
      await apiService.changeMyPassword({ oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setNotice('Password changed. You will be logged out on all devices.');
      await onLogout();
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const exportAccount = async (includeMessages: boolean) => {
    setNotice('');
    setError('');
    try {
      const data = await apiService.exportMyAccount(includeMessages);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dip-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice('Export downloaded');
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const requestDeleteCode = async () => {
    setNotice('');
    setError('');
    try {
      const r = await apiService.requestDeleteAccountCode();
      if (r.code) {
        setNotice(`Delete confirmation code: ${r.code} (shown because AUTH_DEBUG_CODES is enabled on server)`);
      } else {
        setNotice('Confirmation code issued. Use your configured delivery channel.');
      }
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const deleteAccount = async () => {
    setNotice('');
    setError('');
    try {
      if (deleteConfirmMode === 'password') {
        await apiService.deleteMyAccount({ password: deletePassword });
      } else {
        await apiService.deleteMyAccount({ confirmationCode: deleteConfirmCode.trim() });
      }
      setNotice('Account deleted');
      await onLogout();
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    }
  };

  const canSubmitDelete =
    deleteConfirmMode === 'password'
      ? deletePassword.length >= 8
      : /^\d{6}$/.test(deleteConfirmCode.trim());

  return (
    <div className={s.backdrop} onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        className={[s.sheet, isMobile ? s.sheetMobile : s.sheetDesktop].join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s.sheetHeader}>
          <div className={s.identityRow}>
            <div className={s.avatar} aria-hidden="true">
              {initials}
            </div>
            <div className={s.minWidth0}>
              <div className={s.nameRow}>
                <div className={s.name}>{user.username}</div>
                <span className={s.rolePill}>{roleLabel}</span>
                <span className={verified ? s.verifiedPill : s.unverifiedPill}>
                  {verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className={s.meta}>
                <span>
                  ID <code className={s.code}>{user.id}</code>
                </span>
                {user.createdAt ? <span>Created {new Date(user.createdAt).toLocaleDateString()}</span> : null}
              </div>
            </div>
          </div>

          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </div>

        {notice ? <div className={s.notice}>{notice}</div> : null}
        {error ? <div className={s.errorBox}>{error}</div> : null}

        <div className={s.section}>
          <div className={s.sectionTitle}>Profile</div>
          <div className={s.formGrid}>
            <div className={s.field}>
              <div className={s.label}>Avatar file (jpg/png ≤ 5MB)</div>
              <input
                className={s.input}
                type="file"
                accept="image/png,image/jpeg"
                disabled={avatarUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.currentTarget.value = '';
                }}
              />
              <div className={s.help}>
                Current: <code className={s.code}>{user.avatarUrl || 'none'}</code>
              </div>
            </div>
            <div className={s.field}>
              <div className={s.label}>Name</div>
              <input
                className={s.input}
                value={profileDraft.name}
                onChange={(e) => setProfileDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className={s.field}>
              <div className={s.label}>Username</div>
              <input
                className={s.input}
                value={profileDraft.username}
                onChange={(e) => setProfileDraft((p) => ({ ...p, username: e.target.value }))}
                placeholder="username"
              />
              <div className={s.help}>3–20 chars: latin, digits, underscore.</div>
            </div>
            <div className={s.field}>
              <div className={s.label}>Avatar URL</div>
              <input
                className={s.input}
                value={profileDraft.avatarUrl}
                onChange={(e) => setProfileDraft((p) => ({ ...p, avatarUrl: e.target.value }))}
                placeholder="https://.../avatar.png"
              />
              <div className={s.help}>Можно оставить пустым и использовать загрузку файла выше.</div>
            </div>
            <button className={s.secondaryButton} onClick={saveProfile}>Save profile</button>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Privacy</div>
          <div className={s.formGrid}>
            <div className={s.field}>
              <div className={s.label}>Who can write to me</div>
              <select
                className={s.select}
                value={privacy?.allowMessagesFrom || 'EVERYONE'}
                onChange={(e) =>
                  setPrivacy((p) => (p ? { ...p, allowMessagesFrom: e.target.value as any } : p))
                }
              >
                <option value="EVERYONE">Everyone</option>
                <option value="CONTACTS_ONLY">Contacts only</option>
                <option value="NOBODY">Nobody</option>
              </select>
              <div className={s.help}>
                Если выбрано «Contacts only», писать вам смогут только те, кого вы добавили в контакты ниже.
              </div>
            </div>
            <button className={s.secondaryButton} onClick={savePrivacy} disabled={!privacy}>Save privacy</button>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Contacts</div>
          <div className={s.formGrid}>
            <div className={s.field}>
              <div className={s.label}>Add contact by user ID</div>
              <div className={s.row2}>
                <input
                  className={s.input}
                  value={contactUserId}
                  onChange={(e) => setContactUserId(e.target.value)}
                  placeholder="User UUID"
                />
                <button className={s.secondaryButton} onClick={addContact} disabled={contactUserId.trim().length < 8}>
                  Add
                </button>
              </div>
              <div className={s.help}>
                При «Contacts only» получатель должен добавить вас в свои контакты, чтобы вы могли ему писать.
              </div>
            </div>
            <div className={s.list}>
              {contacts.length === 0 ? (
                <div className={s.help}>No contacts yet</div>
              ) : (
                contacts.map((row) => (
                  <div key={row.id} className={s.listItem}>
                    <div className={s.min0}>
                      <div className={s.listTitle}>@{row.contactUser?.username || row.contactUserId}</div>
                      <div className={s.listMeta}>{row.contactUser?.id || row.contactUserId}</div>
                    </div>
                    <button type="button" className={s.smallButton} onClick={() => removeContact(row.contactUserId)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Blacklist</div>
          <div className={s.formGrid}>
            <div className={s.field}>
              <div className={s.label}>Block user by ID</div>
              <div className={s.row2}>
                <input
                  className={s.input}
                  value={blockUserId}
                  onChange={(e) => setBlockUserId(e.target.value)}
                  placeholder="User UUID"
                />
                <button className={s.secondaryButton} onClick={blockUser} disabled={blockUserId.trim().length < 8}>
                  Block
                </button>
              </div>
              <div className={s.help}>В демо можно брать ID из профиля пользователя.</div>
            </div>

            <div className={s.list}>
              {blacklist.length === 0 ? (
                <div className={s.help}>No blocked users</div>
              ) : (
                blacklist.map((row) => (
                  <div key={row.id} className={s.listItem}>
                    <div className={[s.min0].join(' ')}>
                      <div className={s.listTitle}>@{row.blockedUser?.username || row.blockedUserId}</div>
                      <div className={s.listMeta}>
                        {row.blockedUser?.id || row.blockedUserId}
                      </div>
                    </div>
                    <button className={s.smallButton} onClick={() => unblockUser(row.blockedUserId)}>
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Security</div>
          <div className={s.formGrid}>
            <div className={s.row2}>
              <div className={s.field}>
                <div className={s.label}>Old password</div>
                <input className={s.input} type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
              </div>
              <div className={s.field}>
                <div className={s.label}>New password</div>
                <input className={s.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>
            <button
              className={s.secondaryButton}
              onClick={changePassword}
              disabled={oldPassword.length < 8 || newPassword.length < 8}
            >
              Change password
            </button>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Account data</div>
          <div className={s.actionGrid}>
            <button className={s.secondaryButton} onClick={() => exportAccount(false)}>Export JSON</button>
            <button className={s.secondaryButton} onClick={() => exportAccount(true)}>Export JSON + messages</button>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Quick actions</div>
          <div className={[s.actionGrid, isMobile ? s.actionGridMobile : ''].filter(Boolean).join(' ')}>
            <button className={s.primaryButton} onClick={onRefreshAuth}>Refresh token</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('security')}>Security</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('calls')}>Calls</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('chats')}>Chats</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('risk')}>Risk</button>
            <button className={s.secondaryButton} onClick={() => onNavigate('support')}>Support</button>
            {roleLabel !== 'admin' && (
              <button
                className={roleLabel === 'moderator' ? s.secondaryButton : s.secondaryButtonDisabled}
                disabled={roleLabel !== 'moderator'}
                onClick={() => onNavigate('moderator')}
                title={roleLabel === 'moderator' ? 'Open moderator tools' : 'No access'}
              >
                Moderator
              </button>
            )}
            <button
              className={roleLabel === 'admin' ? s.secondaryButton : s.secondaryButtonDisabled}
              disabled={roleLabel !== 'admin'}
              onClick={() => onNavigate('admin')}
              title={roleLabel === 'admin' ? 'Open admin tools' : 'No access'}
            >
              Admin
            </button>
            <button className={s.dangerButton} onClick={onLogout}>Logout</button>
          </div>
        </div>

        <div className={[s.section, s.dangerZone].join(' ')}>
          <div className={s.dangerTitle}>Danger zone</div>
          <div className={s.dangerHint}>
            This will anonymize your profile and delete personal data. You will be logged out everywhere. Confirm with
            password or a one-time code (per ТЗ).
          </div>
          <div className={s.deleteModeRow} role="radiogroup" aria-label="Delete confirmation method">
            <label className={s.radioLabel}>
              <input
                type="radio"
                name="deleteConfirm"
                checked={deleteConfirmMode === 'password'}
                onChange={() => setDeleteConfirmMode('password')}
              />
              Password
            </label>
            <label className={s.radioLabel}>
              <input
                type="radio"
                name="deleteConfirm"
                checked={deleteConfirmMode === 'code'}
                onChange={() => setDeleteConfirmMode('code')}
              />
              6-digit code
            </label>
          </div>
          {deleteConfirmMode === 'password' ? (
            <div className={s.field}>
              <div className={s.label}>Current password</div>
              <input
                className={s.input}
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
          ) : (
            <div className={s.field}>
              <div className={s.label}>Request a code, then enter it</div>
              <div className={s.rowInline}>
                <button type="button" className={s.secondaryButton} onClick={requestDeleteCode}>
                  Request code
                </button>
              </div>
              <input
                className={s.input}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={deleteConfirmCode}
                onChange={(e) => setDeleteConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>
          )}
          <button className={s.smallDangerButton} onClick={deleteAccount} disabled={!canSubmitDelete}>
            Delete account
          </button>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Status & tips</div>
          <div className={[s.statusGrid, isMobile ? s.statusGridMobile : ''].filter(Boolean).join(' ')}>
            <div className={s.statusCard}>
              <div className={s.statusLabel}>Verification</div>
              <div className={s.statusValue}>{verified ? 'Verified' : 'Not verified'}</div>
              {!verified && (
                <div className={s.statusHint}>
                  Open <b>Security</b> → request verify code.
                </div>
              )}
            </div>
            <div className={s.statusCard}>
              <div className={s.statusLabel}>Role</div>
              <div className={s.statusValue}>{roleLabel}</div>
              <div className={s.statusHint}>
                Role controls access to Admin tools.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
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
// styles moved to UserPage.module.css
