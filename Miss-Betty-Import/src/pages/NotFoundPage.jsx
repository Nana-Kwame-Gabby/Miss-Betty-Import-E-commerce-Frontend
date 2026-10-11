import { Link } from "react-router-dom";
import useSeo from "../hooks/useSeo";

// Unknown URLs: a friendly page that search engines are told not to index.
export default function NotFoundPage() {
  useSeo({ title: "Page not found", description: "This page doesn't exist on Miss Betty Import.", noindex: true });
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-5xl mb-4">🔍</p>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6">The page you're looking for doesn't exist or has moved.</p>
      <div className="flex gap-3">
        <Link to="/shop" className="bg-[#F2AA25] text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90">Browse the shop</Link>
        <Link to="/" className="border border-gray-300 text-[#1e2d3d] font-semibold px-5 py-2.5 rounded-xl hover:border-[#F2AA25]">Home</Link>
      </div>
    </div>
  );
}
