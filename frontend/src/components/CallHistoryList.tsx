import React, { useEffect, useState, useMemo } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus, Info } from 'lucide-react';
import apiService from '../services/api';
import s from './CallHistoryList.module.css';

interface CallHistoryItem {
  id: string;
  hostId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'ended' | 'missed';
  createdAt: string;
  endedAt?: string;
  host?: { id: string; username: string };
  participants?: Array<{ user: { id: string; username: string } }>;
}

interface CallHistoryListProps {
  currentUserId: string;
  onNewCall: () => void;
  onViewDetails?: (call: CallHistoryItem) => void;
}

export const CallHistoryList: React.FC<CallHistoryListProps> = ({
  currentUserId,
  onNewCall,
  onViewDetails,
}) => {
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const data = await apiService.getCallHistory();
        setHistory(data);
      } catch (err) {
        console.error('Failed to load call history:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (filter === 'missed') {
      return history.filter(item => {
        const isHost = item.hostId === currentUserId;
        return item.status === 'missed' || (item.status === 'rejected' && !isHost);
      });
    }
    return history;
  }, [history, filter, currentUserId]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays < 7) {
      return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date);
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const getCallTypeInfo = (call: CallHistoryItem, isHost: boolean) => {
    const isMissed = call.status === 'missed' || (call.status === 'rejected' && !isHost);
    
    if (isMissed) return { label: 'Пропущенный', color: 'var(--danger)', icon: <PhoneMissed size={14} color="var(--danger)" /> };
    if (isHost) return { label: 'Исходящий', color: 'var(--muted)', icon: <PhoneOutgoing size={14} /> };
    return { label: 'Входящий', color: 'var(--muted)', icon: <PhoneIncoming size={14} /> };
  };

  if (loading) return <div className={s.loading}>Загрузка истории...</div>;

  return (
    <div className={s.container}>
      <div className={s.header}>
        <div className={s.editBtn}>Изм.</div>
        <div className={s.filterTabs}>
          <button 
            className={[s.filterTab, filter === 'all' ? s.filterTabActive : ''].join(' ')}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
          <button 
            className={[s.filterTab, filter === 'missed' ? s.filterTabActive : ''].join(' ')}
            onClick={() => setFilter('missed')}
          >
            Пропущ.
          </button>
        </div>
        <div className={s.spacer} />
      </div>

      <button className={s.newCallBtn} onClick={onNewCall}>
        <div className={s.newCallIcon}>
          <Plus size={20} />
          <Phone size={14} className={s.subPhoneIcon} />
        </div>
        <span>Новый звонок</span>
      </button>

      <div className={s.sectionTitle}>НЕДАВНИЕ ЗВОНКИ</div>

      <div className={s.list}>
        {filteredHistory.map(call => {
          const isHost = call.hostId === currentUserId;
          const otherParticipant = call.participants?.find(p => p.user.id !== currentUserId)?.user;
          const remoteUser = isHost ? otherParticipant : call.host;

          if (!remoteUser) return null;

          const typeInfo = getCallTypeInfo(call, isHost);
          const initials = (remoteUser.username?.[0] || '?').toUpperCase();
          const isMissed = typeInfo.label === 'Пропущенный';

          return (
            <div key={call.id} className={s.callItem}>
              <div className={s.avatar}>
                {initials}
              </div>
              <div className={s.callInfo}>
                <div className={[s.name, isMissed ? s.nameMissed : ''].join(' ')}>
                  {remoteUser.username}
                </div>
                <div className={s.statusRow}>
                  {typeInfo.icon}
                  <span className={s.statusLabel} style={{ color: typeInfo.color }}>
                    {typeInfo.label}
                  </span>
                </div>
              </div>
              <div className={s.rightSide}>
                <span className={s.time}>{formatTime(call.createdAt)}</span>
                {onViewDetails && (
                  <button className={s.infoBtn} onClick={() => onViewDetails?.(call)}>
                    <Info size={20} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredHistory.length === 0 && (
          <div className={s.empty}>Звонков не найдено</div>
        )}
      </div>
    </div>
  );
};
