import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      // Remove code from URL immediately — prevents re-exchange if user refreshes the page
      window.history.replaceState({}, "", window.location.pathname);

      supabase.auth.exchangeCodeForSession(code)
        .then(({ data: { session }, error: exchangeError }) => {
          if (!exchangeError && session) {
            setReady(true);
          } else {
            setLinkError(
              exchangeError?.message?.toLowerCase().includes("expired")
                ? "This reset link has expired. Please request a new one."
                : "This reset link has already been used or is invalid. Please request a new one."
            );
          }
        })
        .catch(() => {
          setLinkError("This reset link could not be verified. Please request a new one.");
        });
    } else {
      // No code in URL — check for an existing recovery session (e.g. user navigated back)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setReady(true);
        } else {
          setLinkError("No reset link found. Please request a new password reset.");
        }
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Accept both RECOVERY and SIGNED_IN — Supabase may fire either after code exchange
      if ((event === "RECOVERY" || event === "SIGNED_IN") && session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Both fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login"), 2000);
  }

  const inputClass =
    "w-full h-12 border border-mbi-border-strong rounded-lg px-4 text-base text-mbi-navy bg-white placeholder:text-mbi-slate outline-none focus:border-mbi-navy focus:ring-2 focus:ring-mbi-amber/40";

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

        {success ? (
          /* Success state */
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-mbi-available-tint rounded-full flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-mbi-available" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy text-center mb-1">
              Password Updated!
            </h1>
            <p className="text-sm text-mbi-slate text-center">
              Redirecting you to login…
            </p>
          </div>
        ) : linkError ? (
          /* Link invalid / expired state */
          <div className="w-full flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 bg-mbi-error-tint rounded-full flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-mbi-error" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy text-center mb-2">
              Link Expired
            </h1>
            <p className="text-sm text-mbi-slate text-center mb-5">
              {linkError}
            </p>
            <Link
              to="/forgot-password"
              className="mbi-press w-full h-12 rounded-lg bg-mbi-amber text-mbi-navy text-base font-semibold hover:bg-mbi-amber-press cursor-pointer flex items-center justify-center"
            >
              Request New Reset Link
            </Link>
          </div>
        ) : !ready ? (
          /* Verifying token state */
          <div className="w-full flex flex-col items-center text-center py-4">
            <div className="w-10 h-10 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin mb-4" />
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy text-center mb-1">
              Verifying your reset link…
            </h1>
            <p className="text-sm text-mbi-slate text-center">
              Please wait a moment.
            </p>
          </div>
        ) : (
          /* New password form */
          <>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy text-center mb-1">
              Set New Password
            </h1>
            <p className="text-sm text-mbi-slate text-center mb-4">
              Choose a strong password for your account
            </p>

            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
              <div className="w-full mb-3">
                <label className="block font-semibold text-mbi-navy mb-1.5 text-sm">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
              </div>

              <div className="w-full mb-4">
                <label className="block font-semibold text-mbi-navy mb-1.5 text-sm">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="w-full text-mbi-error text-xs mb-3 bg-mbi-error-tint border border-mbi-error/30 rounded-lg px-3 py-1.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mbi-press w-full h-12 rounded-lg bg-mbi-amber text-mbi-navy text-base font-semibold hover:bg-mbi-amber-press cursor-pointer mb-4 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Updating…
                  </>
                ) : "Update Password"}
              </button>
            </form>

            <p className="text-sm text-mbi-navy-body text-center">
              <Link to="/" className="font-semibold text-mbi-amber-ink underline-offset-2 hover:underline">
                ← Back to Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
