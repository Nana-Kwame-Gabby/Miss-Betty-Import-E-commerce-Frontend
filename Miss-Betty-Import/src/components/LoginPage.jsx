import logo from "../assets/logo.png";
import { Link } from "react-router-dom";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className=" bg-white rounded-lg shadow-lg size-150 flex justify-center items-center flex-col pb-10 ">
        <style>{`
        .spin-vertical{
          animation: spinY 5s linear infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
        @keyframes spinY {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
      `}</style>
        <div>
          <img
            src={logo}
            alt="Miss Betty Import Logo"
            className="h-20 mx-auto spin-vertical"
          />
        </div>
        <div className="text-center mb-10 ">
          <h1 className="font-semibold text-2xl">
            Welcome to Miss Betty Import
          </h1>
          <p className="text-l font-medium">Please log in to continue</p>
        </div>
        <div className="border rounded-sm p-1 mb-2 w-sm h-10">
          <input
            type="email"
            id="email"
            placeholder="Email"
            className=" outline-none w-sm p-1"
          />
        </div>
        <div className="border rounded-sm p-1 mt-sm w-sm h-10">
          <input
            type="password"
            id="password"
            placeholder="Password"
            className=" outline-none w-sm p-1"
          />
        </div>
        <button className="bg-gray-700 font-semibold text-white p-2 rounded-sm mt-8 w-24">
          Log in
        </button>
        <div className="mt-12 text-center">
          <p>Don't have an account?</p>
          <Link to="/signup" className="text-blue-500">
            Sign up
          </Link>
        </div>
        <hr className="w-sm border-t border-gray-300 mx-auto mt-4" />

        <div className="mt-10">
          <a href="/forgot-password" className="text-blue-500">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
