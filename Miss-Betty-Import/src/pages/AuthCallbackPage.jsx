import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorDescription = params.get("error_description") || "";

    function isBlockedGoogleSignup(message) {
      return typeof message === "string" && message.includes("MBI_NO_CUSTOMER_ACCOUNT");
    }

    // GoTrue rejected the sign-in server-side (Before User Created hook)
    // before ever issuing a code — surfaced via ?error_description=.
    if (!code && isBlockedGoogleSignup(errorDescription)) {
      sessionStorage.setItem('oauth_denied', '1');
      navigate("/signup", { replace: true });
      return;
    }

    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    let redirected = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (redirected) return;
      if (event === "RECOVERY" && session) {
        redirected = true;
        navigate("/reset-password", { replace: true });
      }
    });

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (redirected) return;
      if (error) {
        // A code was issued but the exchange itself was rejected by the
        // hook (alternate surfacing path — see comment above).
        if (isBlockedGoogleSignup(error.message)) {
          sessionStorage.setItem('oauth_denied', '1');
          navigate("/signup", { replace: true });
          return;
        }
        // The code may already have been exchanged by the Supabase client's
        // own automatic URL detection (default detectSessionInUrl: true)
        // before this explicit call ran — that's a real, separate success,
        // not a failure. Check for an existing session before giving up.
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            if (sessionStorage.getItem('pwd_reset')) {
              sessionStorage.removeItem('pwd_reset');
              navigate("/reset-password", { replace: true });
            } else {
              navigate("/shop", { replace: true });
            }
          } else {
            navigate("/login", { replace: true });
          }
        });
      } else if (!redirected) {
        if (sessionStorage.getItem('pwd_reset')) {
          sessionStorage.removeItem('pwd_reset');
          navigate("/reset-password", { replace: true });
        } else {
          navigate("/shop", { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
