import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import usePersistedState from "../../hooks/usePersistedState";

const TITLE_MAX = 150;
const MESSAGE_MAX = 1000;

export default function AdminNotificationsPage() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [form,       setForm]       = usePersistedState("mbimport_form_admin_notification_draft", { title: "", message: "", link_url: "" });
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
      <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy mb-1">Notifications</h1>
      <p className="text-sm text-mbi-slate mb-6">Send broadcast notifications to all registered customers</p>

      {/* Compose */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-6">
        <h2 className="text-sm font-bold text-mbi-navy mb-3">Compose Notification</h2>

        <div className="mb-3">
          <label className="block font-semibold text-mbi-navy mb-1.5 text-xs">Title</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, TITLE_MAX) }))}
            placeholder="e.g. New products just arrived!"
            className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy transition-colors"
          />
          <p className="text-xs text-mbi-slate mt-1">{form.title.length} / {TITLE_MAX}</p>
        </div>

        <div className="mb-3">
          <label className="block font-semibold text-mbi-navy mb-1.5 text-xs">Message</label>
          <textarea
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value.slice(0, MESSAGE_MAX) }))}
            placeholder="Type the notification message…"
            rows={4}
            className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none transition-colors"
          />
          <p className="text-xs text-mbi-slate mt-1">{form.message.length} / {MESSAGE_MAX}</p>
        </div>

        <div className="mb-4">
          <label className="block font-semibold text-mbi-navy mb-1.5 text-xs">Link (optional)</label>
          <input
            value={form.link_url}
            onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
            placeholder="e.g. /shop/12"
            className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy transition-colors"
          />
        </div>

        {banner && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
            banner.type === "success"
              ? "bg-mbi-available-tint text-mbi-available border border-mbi-available/30"
              : "bg-mbi-error-tint text-mbi-error border border-mbi-error/30"
          }`}>
            {banner.text}
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canSend}
          className="mbi-press flex items-center gap-2 bg-mbi-navy text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {submitting ? "Sending…" : "Send Notification"}
        </button>
      </div>

      {/* History */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-mbi-hairline-soft">
          <h2 className="text-sm font-bold text-mbi-navy">Sent Notifications</h2>
          <p className="text-xs text-mbi-slate mt-0.5">Previously sent notifications</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-mbi-slate text-sm">No notifications sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                    <td className="px-5 py-3 text-mbi-slate whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString("en-GH", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-mbi-navy font-semibold max-w-[10rem]">
                      <p className="truncate" title={n.title}>{n.title}</p>
                    </td>
                    <td className="px-4 py-3 text-mbi-slate max-w-xs">
                      <p className="truncate" title={n.message}>{n.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        n.type === "new_product"
                          ? "bg-mbi-preorder-tint text-mbi-navy"
                          : "bg-mbi-surface-soft text-mbi-navy-body"
                      }`}>
                        {n.type === "new_product" ? "Auto: New Product" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(n)} className="text-xs font-semibold text-mbi-amber-ink hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(n)} className="text-xs font-semibold text-mbi-error hover:underline">
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
          <div className="relative bg-white rounded-mbi-card shadow-mbi-float w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-mbi-navy mb-1">Send Notification?</h3>
            <p className="text-sm text-mbi-slate mb-4">
              This will be visible to <strong>all registered customers</strong>. This action cannot be undone.
            </p>
            <div className="bg-mbi-surface-soft border border-mbi-hairline-soft rounded-lg px-3 py-2.5 mb-5 text-sm text-mbi-navy-body">
              <p className="font-semibold text-mbi-navy mb-1">{form.title}</p>
              <p className="italic line-clamp-3">"{form.message}"</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-mbi-hairline text-mbi-navy-body font-semibold py-2 rounded-lg hover:bg-mbi-surface-soft transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="mbi-press flex-1 bg-mbi-navy text-white font-semibold py-2 rounded-lg hover:bg-mbi-navy-hover transition-colors text-sm"
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
          <div className="relative bg-white rounded-mbi-card shadow-mbi-float w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-mbi-navy mb-1">Edit Notification</h3>
            <p className="text-xs text-mbi-slate mb-4">Editing won't re-notify customers who already saw this.</p>

            <div className="mb-3">
              <label className="block font-semibold text-mbi-navy mb-1.5 text-xs">Title</label>
              <input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value.slice(0, TITLE_MAX) }))}
                className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy transition-colors"
              />
            </div>

            <div className="mb-3">
              <label className="block font-semibold text-mbi-navy mb-1.5 text-xs">Message</label>
              <textarea
                value={editForm.message}
                onChange={e => setEditForm(f => ({ ...f, message: e.target.value.slice(0, MESSAGE_MAX) }))}
                rows={4}
                className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="block font-semibold text-mbi-navy mb-1.5 text-xs">Link (optional)</label>
              <input
                value={editForm.link_url}
                onChange={e => setEditForm(f => ({ ...f, link_url: e.target.value }))}
                className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy transition-colors"
              />
            </div>

            {editError && (
              <p className="text-xs text-mbi-error font-medium mb-3">{editError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setEditingNotification(null)}
                className="flex-1 border-2 border-mbi-hairline text-mbi-navy-body font-semibold py-2 rounded-lg hover:bg-mbi-surface-soft transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSubmitting}
                className="mbi-press flex-1 bg-mbi-navy text-white font-semibold py-2 rounded-lg hover:bg-mbi-navy-hover transition-colors text-sm disabled:opacity-40"
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
