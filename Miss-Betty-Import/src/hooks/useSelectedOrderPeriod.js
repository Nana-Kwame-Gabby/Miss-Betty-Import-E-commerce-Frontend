import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Shared by every admin order-related page: resolves which order_period_id
// is currently being viewed (the `?period=` query param if present, else the
// active period), and lets a page switch periods via the same param.
export function useSelectedOrderPeriod() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("order_periods")
      .select("*")
      .order("opened_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setPeriods(data ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activePeriod = periods.find(p => p.is_active) ?? null;
  const paramId = searchParams.get("period");
  const selectedId = paramId ? Number(paramId) : (activePeriod?.id ?? null);
  const selectedPeriod = periods.find(p => p.id === selectedId) ?? null;

  const selectPeriod = useCallback((id) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (activePeriod && id === activePeriod.id) next.delete("period");
      else next.set("period", String(id));
      return next;
    }, { replace: true });
  }, [activePeriod, setSearchParams]);

  return { periods, activePeriod, selectedId, selectedPeriod, selectPeriod, loading };
}
