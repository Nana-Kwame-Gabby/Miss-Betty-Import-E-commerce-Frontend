import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const TITLE_MAX = 150;
const MESSAGE_MAX = 1000;

export default function AdminNotificationsPage() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [form,       setForm]       = useState({ title: "", message: "", link_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [banner,     setBanner]     = useState(null); // { type: "success"|"error", text }

  const [editingNotification, setEditingNotification] = useState(null);
  const [editForm,            setEditForm]            = useState({ title: "", message: "", link_url: "" });
  const [editSubmitting,      setEditSubmitting]      = useState(false);
  const [editError,           setEditError]           = useState("");

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setNotifications(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const canSend = form.title.trim().length > 0 && form.message.trim().length > 0 && !submitting;

  async function handleCreate() {
    setShowConfirm(false);
    setSubmitting(true);
    setBanner(null);

    const { error } = await supabase.from("notifications").insert({
      title: form.title.trim(),
      message: form.message.trim(),
      link_url: form.link_url.trim() || null,
      type: "manual",
      created_by: session?.user?.email ?? null,
    });

    if (error) {
      setBanner({ type: "error", text: error.message });
    } else {
      setForm({ title: "", message: "", link_url: "" });
      setBanner({ type: "success", text: "Notification sent to all registered customers." });
      loadAll();
    }

    setSubmitting(false);
  }

  function openEdit(n) {
    setEditingNotification(n);
    setEditForm({ title: n.title, message: n.message, link_url: n.link_url ?? "" });
    setEditError("");
  }

  async function handleEditSave() {
    if (!editForm.title.trim() || !editForm.message.trim()) {
      setEditError("Title and message are required.");
      return;
    }
    setEditSubmitting(true);
    setEditError("");

    const { error } = await supabase
      .from("notifications")
      .update({
        title: editForm.title.trim(),
        message: editForm.message.trim(),
        link_url: editForm.link_url.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingNotification.id);

    if (error) {
      setEditError(error.message);
      setEditSubmitting(false);
      return;
    }

    setEditSubmitting(false);
    setEditingNotification(null);
    loadAll();
  }

  async function handleDelete(n) {
    if (!confirm(`Delete "${n.title}"? Customers who already saw it will no longer see it in their list.`)) return;
    const { error } = await supabase.from("notifications").delete().eq("id", n.id);
    if (error) {
      setBanner({ type: "error", text: error.message });
    } else {
      loadAll();
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Notifications</h1>
      <p className="text-sm text-gray-400 mb-6">Send broadcast notifications to all registered customers</p>

      {/* Compose */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Compose Notification</h2>

        <div className="mb-3">
          <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs">Title</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, TITLE_MAX) }))}
            placeholder="e.g. New products just arrived!"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1">{form.title.length} / {TITLE_MAX}</p>
        </div>

        <div className="mb-3">
          <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs">Message</label>
          <textarea
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value.slice(0, MESSAGE_MAX) }))}
            placeholder="Type the notification message…"
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] resize-none transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1">{form.message.length} / {MESSAGE_MAX}</p>
        </div>

        <div className="mb-4">
          <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs">Link (optional)</label>
          <input
            value={form.link_url}
            onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
            placeholder="e.g. /shop/12"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] transition-colors"
          />
        </div>

        {banner && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-600 border border-red-100"
          }`}>
            {banner.text}
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canSend}
          className="flex items-center gap-2 bg-[#1e2d3d] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {submitting ? "Sending…" : "Send Notification"}
        </button>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1e2d3d]">Sent Notifications</h2>
          <p className="text-xs text-gray-400 mt-0.5">Previously sent notifications</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No notifications sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString("en-GH", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-[#1e2d3d] font-semibold max-w-[10rem]">
                      <p className="truncate" title={n.title}>{n.title}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      <p className="truncate" title={n.message}>{n.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        n.type === "new_product"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {n.type === "new_product" ? "Auto: New Product" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(n)} className="text-xs font-semibold text-[#F2AA25] hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(n)} className="text-xs font-semibold text-red-500 hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-1">Send Notification?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will be visible to <strong>all registered customers</strong>. This action cannot be undone.
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-5 text-sm text-gray-600">
              <p className="font-semibold text-[#1e2d3d] mb-1">{form.title}</p>
              <p className="italic line-clamp-3">"{form.message}"</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-[#1e2d3d] text-white font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editingNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingNotification(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-1">Edit Notification</h3>
            <p className="text-xs text-gray-400 mb-4">Editing won't re-notify customers who already saw this.</p>

            <div className="mb-3">
              <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs">Title</label>
              <input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value.slice(0, TITLE_MAX) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] transition-colors"
              />
            </div>

            <div className="mb-3">
              <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs">Message</label>
              <textarea
                value={editForm.message}
                onChange={e => setEditForm(f => ({ ...f, message: e.target.value.slice(0, MESSAGE_MAX) }))}
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] resize-none transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="block font-semibold text-[#1e2d3d] mb-1.5 text-xs">Link (optional)</label>
              <input
                value={editForm.link_url}
                onChange={e => setEditForm(f => ({ ...f, link_url: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] transition-colors"
              />
            </div>

            {editError && (
              <p className="text-xs text-red-500 font-medium mb-3">{editError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setEditingNotification(null)}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSubmitting}
                className="flex-1 bg-[#1e2d3d] text-white font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-40"
              >
                {editSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
