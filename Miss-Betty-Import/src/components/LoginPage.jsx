import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    navigate("/shop");
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

        <h1 className="font-bold text-lg sm:text-xl text-[#1e2d3d] text-center">
          Welcome to Miss Betty Import
        </h1>
        <p className="text-xs sm:text-sm font-medium text-center mb-4 sm:mb-5">
          Please log in to continue
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="w-full mb-3">
            <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs sm:text-sm">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full border border-gray-300 rounded-2xl px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#F2AA25]"
            />
          </div>

          <div className="w-full mb-3">
            <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs sm:text-sm">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full border border-gray-300 rounded-2xl px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#F2AA25]"
            />
          </div>

          {error && (
            <p className="w-full text-red-500 text-xs mb-3 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
              {error}
            </p>
          )}

          <div className="w-full flex justify-between items-center mb-4 sm:mb-5">
            <label className="flex items-center gap-2 font-medium text-[#1e2d3d] text-xs sm:text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded" />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-[#F2AA25] font-medium text-xs sm:text-sm">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold text-sm sm:text-base rounded-2xl py-2.5 sm:py-3 mb-4 sm:mb-5 text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#F2AA25" }}
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

        <p className="font-medium text-[#1e2d3d] text-xs sm:text-sm text-center">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold" style={{ color: "#F2AA25" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
