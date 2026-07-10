import { useState, useEffect } from "react";
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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [oauthDenied, setOauthDenied] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('oauth_denied')) {
      sessionStorage.removeItem('oauth_denied');
      setOauthDenied(true);
    }
  }, []);

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
      const isDuplicate =
        signUpError.code === "user_already_exists" ||
        /already registered/i.test(signUpError.message || "");
      setError(
        isDuplicate
          ? "This email address is already registered. Please log in instead."
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError("Account created, but you couldn't be signed in automatically. Please try logging in.");
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
          className="h-16 sm:h-20 mx-auto spin-vertical mb-2"
        />

        <h1 className="font-bold text-xl sm:text-2xl text-center mb-1" style={{ color: "#5c2d0e" }}>
          Create Account
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 text-center mb-4">
          Join Miss Betty Imports today
        </p>

        {oauthDenied && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              No account found for this Google address.
            </p>
            <p className="text-xs text-amber-700">
              Please complete sign-up below to continue. You'll be able to use Google sign-in afterward.
            </p>
          </div>
        )}

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
