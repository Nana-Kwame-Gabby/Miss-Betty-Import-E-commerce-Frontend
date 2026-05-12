import logo from "../assets/logo.png";
import { Link } from "react-router-dom";

export default function SignUp() {
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

        <h1
          className="font-bold text-2xl sm:text-3xl text-center mb-1"
          style={{ color: "#5c2d0e" }}
        >
          Create Account
        </h1>
        <p className="text-sm sm:text-base text-gray-500 text-center mb-6">
          Join Miss Betty Imports today
        </p>

        <div className="w-full mb-4">
          <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            placeholder="John Doe"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
          />
        </div>

        <div className="w-full mb-4">
          <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            placeholder="your@email.com"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
          />
        </div>

        <div className="w-full mb-4">
          <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            placeholder="+233 24 123 4567"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
          />
        </div>

        <div className="w-full mb-4">
          <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
            Password
          </label>
          <input
            type="password"
            id="password"
            placeholder="At least 6 characters"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
          />
        </div>

        <div className="w-full mb-6">
          <label className="block font-semibold text-[#1e2d3d] mb-2 text-sm sm:text-base">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            placeholder="Re-enter your password"
            className="w-full border border-gray-300 rounded-2xl px-4 py-3 sm:py-4 text-sm sm:text-base outline-none focus:border-[#F2AA25]"
          />
        </div>

        <button
          className="w-full font-bold text-base sm:text-lg rounded-2xl py-3 sm:py-4 mb-5 text-white cursor-pointer"
          style={{ backgroundColor: "#F2AA25" }}
        >
          Sign Up
        </button>

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
