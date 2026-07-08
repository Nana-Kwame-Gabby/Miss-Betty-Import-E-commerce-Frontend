import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext({
  notifications: [],
  readIds: new Set(),
  unreadCount: 0,
  loading: true,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export function NotificationProvider({ children }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState(null);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      setReadIds(new Set());
      setUnreadCount(0);
      setCustomerId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: customerRow } = await supabase
        .from("customers")
        .select("customer_id")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setCustomerId(customerRow?.customer_id ?? null);

      const [{ data: notifRows }, { data: readRows }] = await Promise.all([
        supabase.from("notifications")
          .select("id, title, message, link_url, type, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("notification_reads").select("notification_id"),
      ]);

      if (cancelled) return;

      setNotifications(notifRows ?? []);
      setReadIds(new Set((readRows ?? []).map(r => r.notification_id)));

      const [{ count: totalCount }, { count: readCount }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }),
        supabase.from("notification_reads").select("id", { count: "exact", head: true }),
      ]);

      if (cancelled) return;

      setUnreadCount(Math.max(0, (totalCount ?? 0) - (readCount ?? 0)));
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("notifications_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications(prev => prev.map(n => (n.id === payload.new.id ? payload.new : n)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          setReadIds(prev => {
            if (!prev.has(payload.old.id)) return prev;
            const next = new Set(prev);
            next.delete(payload.old.id);
            return next;
          });
          setUnreadCount(prev => (Math.max(0, prev - 1)));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session]);

  async function markAsRead(notificationId) {
    if (!customerId || readIds.has(notificationId)) return;

    setReadIds(prev => new Set(prev).add(notificationId));
    setUnreadCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase.from("notification_reads").insert({
      notification_id: notificationId,
      customer_id: customerId,
    });

    if (error && error.code !== "23505") {
      console.error("[Notifications] markAsRead failed:", error.message);
      setReadIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
      setUnreadCount(prev => prev + 1);
    }
  }

  async function markAllAsRead() {
    if (!customerId) return;
    const unreadIds = notifications.filter(n => !readIds.has(n.id)).map(n => n.id);
    if (unreadIds.length === 0) return;

    setReadIds(prev => new Set([...prev, ...unreadIds]));
    setUnreadCount(0);

    const { error } = await supabase.from("notification_reads").insert(
      unreadIds.map(id => ({ notification_id: id, customer_id: customerId }))
    );

    if (error && error.code !== "23505") {
      console.error("[Notifications] markAllAsRead failed:", error.message);
    }
  }

  return (
    <NotificationContext.Provider value={{ notifications, readIds, unreadCount, loading, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
