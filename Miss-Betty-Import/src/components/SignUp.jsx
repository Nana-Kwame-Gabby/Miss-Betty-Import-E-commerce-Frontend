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
    "w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
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

      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md px-5 py-8 sm:px-10 sm:py-10 flex flex-col items-center">
        <img
          src={logo}
          alt="Miss Betty Import Logo"
          className="h-16 sm:h-20 mx-auto spin-vertical mb-4"
        />

        <h1 className="font-bold text-2xl sm:text-3xl text-center mb-1" style={{ color: "#5c2d0e" }}>
          Create Account
        </h1>
        <p className="text-sm sm:text-base text-gray-500 text-center mb-6">
          Join Miss Betty Imports today
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="w-full mb-4">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" className={inputClass} />
          </div>

          <div className="w-full mb-4">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className={inputClass} />
          </div>

          <div className="w-full mb-4">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">Phone Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233 24 123 4567" className={inputClass} />
          </div>

          <div className="w-full mb-4">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} />
          </div>

          <div className="w-full mb-6">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className={inputClass} />
          </div>

          {error && (
            <p className="w-full text-red-500 text-sm mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold text-base sm:text-lg rounded-2xl py-3 sm:py-4 mb-5 text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#F2AA25" }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Creating account…
              </>
            ) : "Sign Up"}
          </button>
        </form>

        <p className="font-medium text-[#1e2d3d] text-sm sm:text-base text-center">
          Already have an account?{" "}
          <Link to="/" className="font-semibold" style={{ color: "#F2AA25" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
