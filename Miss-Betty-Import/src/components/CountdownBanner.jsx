import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function breakdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function CompactBox({ value }) {
  return (
    <div className="bg-[#F2AA25] text-[#1e2d3d] font-extrabold rounded px-1.5 py-0.5 text-[10px] sm:text-xs leading-none min-w-[1.4rem] text-center">
      {String(value).padStart(2, "0")}
    </div>
  );
}

// Live countdown banner for an admin-managed promotional countdown. Fetches the single
// active countdown (if any), corrects for client clock drift via a server-time RPC, ticks
// locally every second, and stays in sync across all open tabs via realtime — no polling,
// no page refresh needed when the admin creates/edits/activates/deletes a countdown.
export default function CountdownBanner() {
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
      // A promotional banner failing to load isn't worth alarming customers over.
      console.warn("[CountdownBanner] failed to load active countdown:", err.message);
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

  const { days, hours, minutes, seconds } = breakdown(endMs - effectiveNow);

  return (
    <div className="flex items-center gap-1.5 bg-[#1e2d3d] rounded-full pl-3 pr-2 py-1 shrink-0 max-w-full">
      <span className="text-white font-semibold text-[10px] sm:text-xs truncate max-w-[4rem] sm:max-w-[8rem]">{countdown.title}</span>
      <div className="flex items-center gap-0.5">
        <CompactBox value={days} />
        <span className="text-[#F2AA25] text-[10px] font-bold">:</span>
        <CompactBox value={hours} />
        <span className="text-[#F2AA25] text-[10px] font-bold">:</span>
        <CompactBox value={minutes} />
        <span className="text-[#F2AA25] text-[10px] font-bold">:</span>
        <CompactBox value={seconds} />
      </div>
    </div>
  );
}
