import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '../services/ticketService';
import { useSocket } from '../context/SocketContext';

/**
 * useNotifications — manages notification state + real-time updates
 */
export const useNotifications = () => {
  const { on } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getAll({ limit: 20 });
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time push
  useEffect(() => {
    if (!on) return;
    const off = on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev.slice(0, 19)]);
      setUnreadCount(prev => prev + 1);
    });
    return off;
  }, [on]);

  const markRead = useCallback(async (ids = null) => {
    try {
      await notificationService.markRead(ids ? { ids } : { all: true });
      if (ids) {
        setNotifications(prev => prev.map(n => ids.includes(n._id) ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - ids.length));
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch { /* silent */ }
  }, []);

  const removeNotification = useCallback(async (id) => {
    try {
      await notificationService.delete(id);
      setNotifications(prev => {
        const notif = prev.find(n => n._id === id);
        if (notif && !notif.isRead) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n._id !== id);
      });
    } catch { /* silent */ }
  }, []);

  return { notifications, unreadCount, loading, markRead, removeNotification, refresh: fetchNotifications };
};

export default useNotifications;
