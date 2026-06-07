import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";

export default function SignUp() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/shop' },
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError("All fields are required.");
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
    if (!agreedToTerms) {
      setError("You must agree to the Terms & Conditions to create an account.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const { error: customerError } = await supabase.from("customers").insert({
      customer_name: fullName,
      email,
      telephone: phone,
      auth_id: data.user.id,
    });

    if (customerError) {
      setError(customerError.message);
      setLoading(false);
      return;
    }

    navigate("/shop");
  }

  const inputClass =
    "w-full border border-gray-300 rounded-2xl px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#F2AA25]";

  const labelClass = "block font-semibold text-[#1e2d3d] mb-1.5 text-xs sm:text-sm";

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

      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md px-5 py-5 sm:px-8 sm:py-7 flex flex-col items-center">
        <img
          src={logo}
          alt="Miss Betty Import Logo"
          className="h-12 sm:h-14 mx-auto spin-vertical mb-2"
        />

        <h1 className="font-bold text-xl sm:text-2xl text-center mb-1" style={{ color: "#5c2d0e" }}>
          Create Account
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 text-center mb-4">
          Join Miss Betty Imports today
        </p>

        {/* Google sign-up */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-2xl py-2.5 sm:py-3 mb-4 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {googleLoading ? (
            <svg className="animate-spin w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="w-full mb-3">
            <label className={labelClass}>Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" className={inputClass} />
          </div>

          <div className="w-full mb-3">
            <label className={labelClass}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className={inputClass} />
          </div>

          <div className="w-full mb-3">
            <label className={labelClass}>Phone Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233 24 123 4567" className={inputClass} />
          </div>

          <div className="w-full mb-3">
            <label className={labelClass}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} />
          </div>

          <div className="w-full mb-4">
            <label className={labelClass}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className={inputClass} />
          </div>

          {error && (
            <p className="w-full text-red-500 text-xs mb-3 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
              {error}
            </p>
          )}

          <label className="w-full flex items-start gap-2.5 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#F2AA25]"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              I have read and agree to the{" "}
              <Link to="/terms" className="text-[#F2AA25] hover:underline font-medium" target="_blank">
                Terms & Conditions
              </Link>
              {" "}and{" "}
              <Link to="/privacy-policy" className="text-[#F2AA25] hover:underline font-medium" target="_blank">
                Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="w-full font-bold text-sm sm:text-base rounded-2xl py-2.5 sm:py-3 mb-4 text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#F2AA25" }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Creating account…
              </>
            ) : "Sign Up"}
          </button>
        </form>

        <p className="font-medium text-[#1e2d3d] text-xs sm:text-sm text-center">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold" style={{ color: "#F2AA25" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
