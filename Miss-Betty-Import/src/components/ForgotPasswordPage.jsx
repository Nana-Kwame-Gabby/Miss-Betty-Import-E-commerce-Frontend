import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSubmitted(true);
    }
  }

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
          className="h-12 sm:h-14 mx-auto spin-vertical mb-2"
        />

        {submitted ? (
          /* Success state */
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="font-bold text-lg sm:text-xl text-center mb-1" style={{ color: "#5c2d0e" }}>
              Check your email
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 text-center mb-1">
              We've sent a password reset link to
            </p>
            <p className="text-xs sm:text-sm font-semibold text-[#1e2d3d] mb-5 break-all">{email}</p>
            <p className="text-xs text-gray-400 text-center mb-5 leading-relaxed">
              Click the link in the email to reset your password. Check your spam folder if you don't see it.
            </p>
            <Link
              to="/"
              className="w-full font-bold text-sm sm:text-base rounded-2xl py-2.5 sm:py-3 text-white text-center block"
              style={{ backgroundColor: "#F2AA25" }}
            >
              Back to Login
            </Link>
          </div>
        ) : (
          /* Email entry form */
          <>
            <h1 className="font-bold text-lg sm:text-xl text-center mb-1" style={{ color: "#5c2d0e" }}>
              Forgot Password?
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 text-center mb-4">
              Enter your email and we'll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
              <div className="w-full mb-4">
                <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs sm:text-sm">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full border border-gray-300 rounded-2xl px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#F2AA25]"
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
                    Sending…
                  </>
                ) : "Send Reset Link"}
              </button>
            </form>

            <p className="font-medium text-[#1e2d3d] text-xs sm:text-sm text-center">
              Remember your password?{" "}
              <Link to="/" className="font-semibold" style={{ color: "#F2AA25" }}>
                Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
