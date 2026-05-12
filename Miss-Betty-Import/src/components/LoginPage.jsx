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

        <h1 className="font-bold text-xl sm:text-2xl text-[#1e2d3d] text-center">
          Welcome to Miss Betty Import
        </h1>
        <p className="text-sm sm:text-base font-medium text-center mb-6 sm:mb-8">
          Please log in to continue
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="w-full mb-4 sm:mb-5">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
            />
          </div>

          <div className="w-full mb-3 sm:mb-4">
            <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
            />
          </div>

          {error && (
            <p className="w-full text-red-500 text-sm mb-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          <div className="w-full flex justify-between items-center mb-5 sm:mb-6">
            <label className="flex items-center gap-2 font-medium text-[#1e2d3d] text-sm sm:text-base cursor-pointer">
              <input type="checkbox" className="w-4 h-4 sm:w-5 sm:h-5 rounded" />
              Remember me
            </label>
            <a href="/forgot-password" className="text-[#F2AA25] font-medium text-sm sm:text-base">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold text-base sm:text-lg rounded-2xl py-3 sm:py-4 mb-5 sm:mb-6 text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#F2AA25" }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Logging in…
              </>
            ) : "Login"}
          </button>
        </form>

        <p className="font-medium text-[#1e2d3d] text-sm sm:text-base text-center">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold" style={{ color: "#F2AA25" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
