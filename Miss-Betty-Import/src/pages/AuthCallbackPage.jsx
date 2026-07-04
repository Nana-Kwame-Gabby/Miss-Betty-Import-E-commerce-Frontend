import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

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
      if (error) {
        navigate("/login", { replace: true });
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
