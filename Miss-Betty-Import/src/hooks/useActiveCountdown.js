import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function breakdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return { days, minutes };
}

// Loads the single active admin-managed promotional countdown (if any), corrects for
// client clock drift via a server-time RPC, ticks locally every second, and stays in
// sync across all open tabs via realtime — no polling, no page refresh needed when the
// admin creates/edits/activates/deletes a countdown. Returns null while loading, before
// the countdown's start date, after its end date, or when none is active.
export default function useActiveCountdown() {
  const [countdown, setCountdown] = useState(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);

  async function loadActive() {
    try {
      const [{ data: rows }, { data: serverTime }] = await Promise.all([
        supabase
          .from("countdown_timers")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase.rpc("get_server_time"),
      ]);
      setCountdown(rows?.[0] ?? null);
      if (serverTime) {
        setOffsetMs(new Date(serverTime).getTime() - Date.now());
      }
    } catch (err) {
      // A promotional countdown failing to load isn't worth alarming customers over.
      console.warn("[useActiveCountdown] failed to load active countdown:", err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadActive();

    const channel = supabase
      .channel("countdown_timers_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "countdown_timers" }, () => {
        loadActive();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!loaded || !countdown) return null;

  const effectiveNow = now + offsetMs;
  const startMs = new Date(countdown.start_at).getTime();
  const endMs = new Date(countdown.end_at).getTime();

  if (effectiveNow < startMs) return null; // scheduled, not started yet
  if (effectiveNow >= endMs) return null; // expired — disappears entirely

  const { days, minutes } = breakdown(endMs - effectiveNow);
  return { title: countdown.title, days, minutes };
}
