import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";
import { consumePostAuthRedirect } from "../utils/postAuthRedirect";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate(consumePostAuthRedirect() ?? "/shop");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mbi-surface-soft px-4 py-6">
      <style>{`
        .spin-vertical {
          animation: spinY 5s linear infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
        @keyframes spinY {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @media (prefers-reduced-motion: reduce) { .spin-vertical { animation: none; } }
      `}</style>

      <div className="bg-white rounded-mbi-card shadow-mbi-float w-full max-w-md px-5 py-6 sm:px-8 sm:py-8 flex flex-col items-center">
        <img
          src={logo}
          alt="Miss Betty Import Logo"
          className="h-16 sm:h-20 mx-auto spin-vertical mb-2"
        />

        <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy text-center">
          Welcome to Miss Betty Import
        </h1>
        <p className="text-sm text-mbi-slate text-center mb-4 sm:mb-5">
          Please log in to continue
        </p>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="mbi-press w-full h-12 flex items-center justify-center gap-3 border border-mbi-navy/25 rounded-lg mb-4 text-base font-semibold text-mbi-navy bg-white hover:border-mbi-navy disabled:opacity-60 cursor-pointer"
        >
          {googleLoading ? (
            <svg className="animate-spin w-4 h-4 text-mbi-slate" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.7 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.7 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.4C9.8 35.6 16.4 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C42 35.3 44 30 44 24c0-1.3-.1-2.7-.4-3.9z"/>
            </svg>
          )}
          Continue with Google
        </button>

        <div className="w-full flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-mbi-surface-strong" />
          <span className="text-xs text-mbi-slate font-medium">or</span>
          <div className="flex-1 h-px bg-mbi-surface-strong" />
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="w-full mb-3">
            <label className="block font-semibold text-mbi-navy mb-1.5 text-sm">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full h-12 border border-mbi-border-strong rounded-lg px-4 text-base text-mbi-navy bg-white placeholder:text-mbi-slate outline-none focus:border-mbi-navy focus:ring-2 focus:ring-mbi-amber/40"
            />
          </div>

          <div className="w-full mb-3">
            <label className="block font-semibold text-mbi-navy mb-1.5 text-sm">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full h-12 border border-mbi-border-strong rounded-lg px-4 text-base text-mbi-navy bg-white placeholder:text-mbi-slate outline-none focus:border-mbi-navy focus:ring-2 focus:ring-mbi-amber/40"
            />
          </div>

          {error && (
            <p className="w-full text-mbi-error text-xs mb-3 bg-mbi-error-tint border border-mbi-error/30 rounded-lg px-3 py-1.5">
              {error}
            </p>
          )}

          <div className="w-full flex justify-between items-center mb-4 sm:mb-5">
            <label className="flex items-center gap-2 font-medium text-mbi-navy text-xs sm:text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded" />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-mbi-amber-ink font-medium text-xs sm:text-sm">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mbi-press w-full h-12 rounded-lg bg-mbi-amber text-mbi-navy text-base font-semibold hover:bg-mbi-amber-press cursor-pointer mb-4 sm:mb-5 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Logging in…
              </>
            ) : "Login"}
          </button>
        </form>

        <p className="text-sm text-mbi-navy-body text-center">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-mbi-amber-ink underline-offset-2 hover:underline">
            Sign up
          </Link>
        </p>

        <p className="text-xs text-mbi-slate text-center mt-3 leading-relaxed">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="text-mbi-amber-ink hover:underline font-medium">Terms & Conditions</Link>
          {" "}and{" "}
          <Link to="/privacy-policy" className="text-mbi-amber-ink hover:underline font-medium">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
