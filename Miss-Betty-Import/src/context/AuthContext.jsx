import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingCustomer, setCheckingCustomer] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setCheckingCustomer(false);
      return;
    }
    const u = session.user;
    setCheckingCustomer(true);

    async function ensureCustomerRow() {
      const { data: existing } = await supabase
        .from('customers')
        .select('auth_id')
        .eq('auth_id', u.id)
        .maybeSingle();

      if (existing) {
        setCheckingCustomer(false);
        return;
      }

      if (u.app_metadata?.provider === 'google') {
        sessionStorage.setItem('oauth_denied', '1');
        setSession(null);
        await supabase.auth.signOut();
        setCheckingCustomer(false);
        return;
      }

      await supabase.from('customers').insert({
        customer_name: u.user_metadata?.full_name || u.user_metadata?.name || '',
        email: u.email,
        telephone: u.user_metadata?.phone || '',
        auth_id: u.id,
      });
      setCheckingCustomer(false);
    }

    ensureCustomerRow();
  }, [session]);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    const userId = session?.user?.id;
    if (userId) {
      sessionStorage.removeItem(`mbimport_form_checkout_delivery_${userId}`);
      sessionStorage.removeItem(`mbimport_form_checkout_payment_${userId}`);
    }
    await supabase.auth.signOut();
  }

  const isAdmin = session?.user?.app_metadata?.role === 'admin';

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, signIn, signOut, loading, isAdmin, checkingCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
