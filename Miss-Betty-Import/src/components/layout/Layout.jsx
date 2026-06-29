import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BottomNav from "../BottomNav";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
