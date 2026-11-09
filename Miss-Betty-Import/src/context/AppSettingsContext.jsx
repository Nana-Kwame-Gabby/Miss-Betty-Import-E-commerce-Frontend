import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AppSettingsContext = createContext({
  ordersClosed: false,
  announcementMessage: "",
  settingsLoading: true,
  toggleOrdersClosed: async () => {},
  updateAnnouncementMessage: async () => {},
  promoActive: false,
  promoMessage: "",
  savePromoAlert: async () => {},
  setPageShowsNotice: () => {},
});

// Remembers, for this browser tab's visit, that a message was seen or dismissed.
const seenKey = (kind, message) => `mbimport_notice_${kind}:${message}`;
function wasSeen(kind, message) {
  try { return sessionStorage.getItem(seenKey(kind, message)) === "1"; } catch { return false; }
}
function markSeen(kind, message) {
  try { sessionStorage.setItem(seenKey(kind, message), "1"); } catch { /* storage unavailable */ }
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Shown once per visit while pre-orders are closed and the admin has set an announcement.
function AnnouncementModal({ visible, message }) {
  const [dismissed, setDismissed] = useState(() => wasSeen("modal", message));

  useEffect(() => { setDismissed(wasSeen("modal", message)); }, [message]);

  if (!visible || dismissed || !message) return null;
  const close = () => { markSeen("modal", message); setDismissed(true); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mbi-navy/50" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className="bg-white rounded-mbi-card shadow-mbi-float max-w-sm w-full p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="mbi-press absolute top-3 right-3 grid place-items-center size-10 rounded-full text-mbi-slate hover:bg-mbi-surface-soft hover:text-mbi-navy"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        <h2 id="announcement-title" className="pr-10 text-xl font-bold text-mbi-navy">A note from Miss Betty Import</h2>
        <p className="mt-2 text-base leading-relaxed text-mbi-navy-body">{message}</p>
        <button
          type="button"
          onClick={close}
          className="mbi-press mt-5 w-full h-12 rounded-lg bg-mbi-amber font-semibold text-mbi-navy hover:bg-mbi-amber-press"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// Site-wide strip for the same announcement. Pages that show it in their own notice band
// (Shop, Home) switch this off through setPageShowsNotice.
function AnnouncementBanner({ visible, message }) {
  const [dismissed, setDismissed] = useState(() => wasSeen("banner", message));

  useEffect(() => { setDismissed(wasSeen("banner", message)); }, [message]);

  if (!visible || dismissed || !message) return null;

  return (
    <div role="status" className="fixed top-16 left-0 right-0 z-40 bg-mbi-amber-tint text-mbi-navy px-4 py-2 flex items-center justify-between gap-3 border-b border-mbi-hairline">
      <p className="text-sm font-medium truncate">{message}</p>
      <button
        type="button"
        onClick={() => { markSeen("banner", message); setDismissed(true); }}
        className="mbi-press flex-shrink-0 grid place-items-center size-9 rounded-full hover:bg-mbi-navy/10"
        aria-label="Dismiss announcement"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export function AppSettingsProvider({ children }) {
  const [ordersClosed,        setOrdersClosed]        = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [settingsLoading,     setSettingsLoading]     = useState(true);
  const [promoActive,         setPromoActive]         = useState(false);
  const [promoMessage,        setPromoMessage]        = useState("");
  const [pageShowsNotice,     setPageShowsNotice]     = useState(false);

  useEffect(() => {
    async function load() {
      const [ordersResult, promoResult] = await Promise.all([
        supabase.from("app_settings")
          .select("setting_value_bool, setting_value_text")
          .eq("setting_key", "orders_closed")
          .maybeSingle(),
        supabase.from("app_settings")
          .select("setting_value_bool, setting_value_text")
          .eq("setting_key", "promo_alert")
          .maybeSingle(),
      ]);
      setOrdersClosed(ordersResult.data?.setting_value_bool ?? false);
      setAnnouncementMessage(ordersResult.data?.setting_value_text ?? "");
      setPromoActive(promoResult.data?.setting_value_bool ?? false);
      setPromoMessage(promoResult.data?.setting_value_text ?? "");
      setSettingsLoading(false);
    }
    load();

    const channel = supabase
      .channel("app_settings_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_settings", filter: "setting_key=eq.orders_closed" },
        (payload) => {
          setOrdersClosed(payload.new.setting_value_bool ?? false);
          setAnnouncementMessage(payload.new.setting_value_text ?? "");
        }
      )
      .subscribe();

    const promoChannel = supabase
      .channel("promo_alert_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "setting_key=eq.promo_alert" },
        (payload) => {
          setPromoActive(payload.new.setting_value_bool ?? false);
          setPromoMessage(payload.new.setting_value_text ?? "");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(promoChannel);
    };
  }, []);

  async function toggleOrdersClosed(value) {
    setOrdersClosed(value);
    await supabase
      .from("app_settings")
      .update({ setting_value_bool: value, updated_at: new Date().toISOString() })
      .eq("setting_key", "orders_closed");
  }

  async function updateAnnouncementMessage(msg) {
    setAnnouncementMessage(msg);
    await supabase
      .from("app_settings")
      .update({ setting_value_text: msg || null, updated_at: new Date().toISOString() })
      .eq("setting_key", "orders_closed");
  }

  async function savePromoAlert(active, message) {
    setPromoActive(active);
    setPromoMessage(message);

    const payload = {
      setting_value_bool: active,
      setting_value_text: message || null,
      updated_at: new Date().toISOString(),
    };

    // Check whether the promo_alert row exists, then UPDATE or INSERT.
    // upsert(onConflict) is avoided because setting_key may not have a unique
    // constraint — this explicit pattern works regardless of the schema.
    const { data: existing } = await supabase
      .from("app_settings")
      .select("setting_key")
      .eq("setting_key", "promo_alert")
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from("app_settings")
          .update(payload)
          .eq("setting_key", "promo_alert")
      : await supabase
          .from("app_settings")
          .insert({ setting_key: "promo_alert", ...payload });

    if (error) console.error("[PromoAlert] save error:", error.message);
    return error ?? null;
  }

  return (
    <AppSettingsContext.Provider value={{
      ordersClosed, announcementMessage, settingsLoading,
      toggleOrdersClosed, updateAnnouncementMessage,
      promoActive, promoMessage, savePromoAlert, setPageShowsNotice,
    }}>
      {children}
      <AnnouncementModal visible={ordersClosed && !!announcementMessage} message={announcementMessage} />
      <AnnouncementBanner visible={ordersClosed && !!announcementMessage && !pageShowsNotice} message={announcementMessage} />
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
