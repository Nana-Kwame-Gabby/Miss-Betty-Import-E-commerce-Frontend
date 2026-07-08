import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";

function timeAgo(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GH", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationBell() {
  const { notifications, readIds, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleRowClick(n) {
    markAsRead(n.id);
    setOpen(false);
    if (n.link_url) navigate(n.link_url);
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-[#1e2d3d] hover:text-[#F2AA25] transition-colors"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white shadow-lg rounded-2xl w-80 sm:w-96 max-h-[28rem] flex flex-col z-50 border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-sm font-bold text-[#1e2d3d]">Notifications</h3>
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-[#F2AA25] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          </div>

          <div className="overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No notifications yet.</div>
            ) : (
              notifications.map(n => {
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleRowClick(n)}
                    className={`w-full text-left flex gap-2.5 px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                      isRead ? "text-gray-500" : "text-[#1e2d3d] bg-[#F2AA25]/5"
                    }`}
                  >
                    <span className={`flex-shrink-0 mt-1.5 w-2 h-2 rounded-full ${isRead ? "invisible" : "bg-[#F2AA25]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${isRead ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                      <span className="block text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</span>
                      <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
