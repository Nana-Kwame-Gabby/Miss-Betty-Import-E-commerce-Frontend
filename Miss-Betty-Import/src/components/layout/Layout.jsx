import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import ShopFooter from "../shop/ShopFooter";
import ShopNotice from "../shop/ShopNotice";
import BottomNav from "../BottomNav";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 pb-16 lg:pb-0">
        <ShopNotice announcementOnly />
        <Outlet />
      </main>
      <ShopFooter />
      <BottomNav />
    </div>
  );
}
