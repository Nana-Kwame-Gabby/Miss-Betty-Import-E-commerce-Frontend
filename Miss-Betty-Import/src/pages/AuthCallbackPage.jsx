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

    function goToDestination() {
      if (redirected) return;
      redirected = true;
      if (sessionStorage.getItem('pwd_reset')) {
        sessionStorage.removeItem('pwd_reset');
        navigate("/reset-password", { replace: true });
      } else {
        navigate("/shop", { replace: true });
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (redirected) return;
      if (event === "RECOVERY" && session) {
        redirected = true;
        navigate("/reset-password", { replace: true });
      } else if (event === "SIGNED_IN" && session) {
        goToDestination();
      }
    });

    // The Supabase client auto-exchanges the code as part of its own
    // initialization (detectSessionInUrl: true), independent of and racing
    // the explicit call below. On fast connections it can finish before this
    // effect even runs, so check for an already-established session up front.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goToDestination();
    });

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (redirected) return;
      if (error) {
        // A code was issued but the exchange itself was rejected by the
        // hook (alternate surfacing path — see comment above).
        if (isBlockedGoogleSignup(error.message)) {
          redirected = true;
          sessionStorage.setItem('oauth_denied', '1');
          navigate("/signup", { replace: true });
          return;
        }
        // The code may have already been consumed by the automatic exchange
        // above; give it a brief moment to finish before concluding failure.
        setTimeout(() => {
          if (redirected) return;
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              goToDestination();
            } else {
              navigate("/login", { replace: true });
            }
          });
        }, 500);
      } else {
        goToDestination();
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
