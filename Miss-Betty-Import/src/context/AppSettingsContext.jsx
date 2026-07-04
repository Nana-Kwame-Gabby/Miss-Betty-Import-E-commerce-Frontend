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
});

function AnnouncementModal({ visible, message }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setDismissed(false); }, [message]);

  if (!visible || dismissed || !message) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setDismissed(true)}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div className="text-center px-2">
          <span className="text-4xl mb-3 block">📢</span>
          <h2 className="font-bold text-[#1e2d3d] text-lg mb-2">Notice</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="mt-5 w-full bg-[#F2AA25] text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function AnnouncementBanner({ visible, message }) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state whenever the message changes
  useEffect(() => { setDismissed(false); }, [message]);

  if (!visible || dismissed || !message) return null;

  return (
    <div className="fixed top-12 left-0 right-0 z-40 bg-[#F2AA25] text-[#1e2d3d] px-4 py-2.5 flex items-center justify-between gap-4 shadow-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="flex-shrink-0 text-base">📢</span>
        <p className="text-sm font-medium truncate">{message}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
        aria-label="Dismiss"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
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
      promoActive, promoMessage, savePromoAlert,
    }}>
      {children}
      <AnnouncementModal visible={ordersClosed && !!announcementMessage} message={announcementMessage} />
      <AnnouncementBanner visible={ordersClosed && !!announcementMessage} message={announcementMessage} />
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
