import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

export default function VerifyEmailPage() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-6">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md px-5 py-8 sm:px-8 flex flex-col items-center text-center">
        <img src={logo} alt="Miss Betty Import" className="h-16 mb-4" />
        <h1 className="font-bold text-xl text-[#1e2d3d] mb-2">Verify your email</h1>
        <p className="text-sm text-gray-500 mb-1">We sent a verification link to:</p>
        <p className="font-semibold text-[#1e2d3d] mb-5 text-sm">{email}</p>
        <p className="text-xs text-gray-400 mb-6">
          Click the link in that email to activate your account. Check your spam folder if you don't see it.
        </p>
        {resent ? (
          <p className="text-xs text-green-600 font-semibold mb-4">Verification email resent!</p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-2.5 rounded-2xl text-sm font-bold text-white mb-3 disabled:opacity-60"
            style={{ backgroundColor: "#F2AA25" }}
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>
        )}
        <button
          onClick={signOut}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
