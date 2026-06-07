import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "RECOVERY") setReady(true);
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
    setTimeout(() => navigate("/"), 2000);
  }

  const inputClass =
    "w-full border border-gray-300 rounded-2xl px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#F2AA25]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-6">
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
      `}</style>

      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md px-5 py-6 sm:px-8 sm:py-8 flex flex-col items-center">
        <img
          src={logo}
          alt="Miss Betty Import Logo"
          className="h-16 sm:h-20 mx-auto spin-vertical mb-2"
        />

        {success ? (
          /* Success state */
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="font-bold text-lg sm:text-xl text-center mb-1" style={{ color: "#5c2d0e" }}>
              Password Updated!
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 text-center">
              Redirecting you to login…
            </p>
          </div>
        ) : !ready ? (
          /* Verifying token state */
          <div className="w-full flex flex-col items-center text-center py-4">
            <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin mb-4" />
            <h1 className="font-bold text-lg sm:text-xl text-center mb-1" style={{ color: "#5c2d0e" }}>
              Verifying your reset link…
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 text-center">
              Please wait a moment.
            </p>
            <p className="text-xs text-gray-400 text-center mt-4">
              If this takes too long,{" "}
              <Link to="/forgot-password" className="font-semibold" style={{ color: "#F2AA25" }}>
                request a new link
              </Link>
            </p>
          </div>
        ) : (
          /* New password form */
          <>
            <h1 className="font-bold text-lg sm:text-xl text-center mb-1" style={{ color: "#5c2d0e" }}>
              Set New Password
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 text-center mb-4">
              Choose a strong password for your account
            </p>

            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
              <div className="w-full mb-3">
                <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs sm:text-sm">
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
                <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs sm:text-sm">
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
                <p className="w-full text-red-500 text-xs mb-3 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full font-bold text-sm sm:text-base rounded-2xl py-2.5 sm:py-3 mb-4 text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#F2AA25" }}
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

            <p className="font-medium text-[#1e2d3d] text-xs sm:text-sm text-center">
              <Link to="/" className="font-semibold" style={{ color: "#F2AA25" }}>
                ← Back to Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
