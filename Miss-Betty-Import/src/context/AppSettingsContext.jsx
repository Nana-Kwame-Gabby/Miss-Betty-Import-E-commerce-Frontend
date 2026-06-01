import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const AppSettingsContext = createContext({ ordersClosed: false, settingsLoading: true, toggleOrdersClosed: async () => {} });

export function AppSettingsProvider({ children }) {
  const { session } = useAuth();
  const [ordersClosed, setOrdersClosed]     = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    if (!session) { setSettingsLoading(false); return; }

    async function load() {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value_bool")
        .eq("setting_key", "orders_closed")
        .single();
      setOrdersClosed(data?.setting_value_bool ?? false);
      setSettingsLoading(false);
    }
    load();
  }, [session]);

  async function toggleOrdersClosed(value) {
    setOrdersClosed(value);
    await supabase
      .from("app_settings")
      .update({ setting_value_bool: value, updated_at: new Date().toISOString() })
      .eq("setting_key", "orders_closed");
  }

  return (
    <AppSettingsContext.Provider value={{ ordersClosed, settingsLoading, toggleOrdersClosed }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
