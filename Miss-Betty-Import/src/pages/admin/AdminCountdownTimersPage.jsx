import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const EMPTY_FORM = { title: "", start_at: "", end_at: "" };

// datetime-local inputs use "YYYY-MM-DDTHH:mm" with no timezone, which JS parses/formats
// as local time — exactly what round-tripping to/from a timestamptz column needs.
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getStatus(c) {
  const now = new Date();
  const start = new Date(c.start_at);
  const end = new Date(c.end_at);
  if (now < start) return { label: "Scheduled", className: "bg-blue-100 text-blue-700" };
  if (now >= end) return { label: "Expired", className: "bg-gray-100 text-gray-500" };
  return { label: "Live", className: "bg-green-100 text-green-700" };
}

function ToggleSwitch({ active, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
        active ? "bg-[#F2AA25]" : "bg-gray-300"
      }`}
      style={{ width: "44px" }}
      aria-label="Toggle countdown active"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          active ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AdminCountdownTimersPage() {
  const [countdowns, setCountdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "success"|"error", text }

  const [editingCountdown, setEditingCountdown] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [togglingId, setTogglingId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("countdown_timers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setCountdowns(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function validate(f) {
    if (!f.title.trim()) return "Title is required.";
    if (!f.start_at || !f.end_at) return "Start and end date/time are required.";
    if (new Date(f.end_at) <= new Date(f.start_at)) return "End date/time must be after the start date/time.";
    return "";
  }

  async function handleCreate() {
    const err = validate(form);
    if (err) { setBanner({ type: "error", text: err }); return; }

    setSubmitting(true);
    setBanner(null);

    const { error } = await supabase.from("countdown_timers").insert({
      title: form.title.trim(),
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
    });

    if (error) {
      setBanner({ type: "error", text: error.message });
    } else {
      setForm(EMPTY_FORM);
      setBanner({ type: "success", text: "Countdown created." });
      loadAll();
    }
    setSubmitting(false);
  }

  function openEdit(c) {
    setEditingCountdown(c);
    setEditForm({
      title: c.title,
      start_at: toDatetimeLocalValue(c.start_at),
      end_at: toDatetimeLocalValue(c.end_at),
    });
    setEditError("");
  }

  async function handleEditSave() {
    const err = validate(editForm);
    if (err) { setEditError(err); return; }

    setEditSubmitting(true);
    setEditError("");

    const { error } = await supabase
      .from("countdown_timers")
      .update({
        title: editForm.title.trim(),
        start_at: new Date(editForm.start_at).toISOString(),
        end_at: new Date(editForm.end_at).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingCountdown.id);

    if (error) {
      setEditError(error.message);
      setEditSubmitting(false);
      return;
    }

    setEditSubmitting(false);
    setEditingCountdown(null);
    loadAll();
  }

  async function handleDelete(c) {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("countdown_timers").delete().eq("id", c.id);
    if (error) {
      setBanner({ type: "error", text: error.message });
    } else {
      loadAll();
    }
  }

  async function handleToggleActive(c) {
    setTogglingId(c.id);
    // The trg_enforce_single_active_countdown trigger automatically deactivates
    // whichever countdown was previously active — no extra client logic needed.
    const { error } = await supabase
      .from("countdown_timers")
      .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      setBanner({ type: "error", text: error.message });
    } else {
      loadAll();
    }
    setTogglingId(null);
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] transition-colors";
  const labelClass = "block font-semibold text-[#1e2d3d] mb-1.5 text-xs";

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Countdown Timers</h1>
      <p className="text-sm text-gray-400 mb-6">
        Create promotional countdowns for Home and Shop. Only one countdown can be active at a time —
        activating one automatically deactivates any other.
      </p>

      {/* Create form */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Create Countdown</h2>

        <div className="mb-3">
          <label className={labelClass}>Title</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. August Promo Ends"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelClass}>Start Date &amp; Time</label>
            <input
              type="datetime-local"
              value={form.start_at}
              onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>End Date &amp; Time</label>
            <input
              type="datetime-local"
              value={form.end_at}
              onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
              className={inputClass}
            />
          </div>
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
          onClick={handleCreate}
          disabled={submitting}
          className="bg-[#1e2d3d] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {submitting ? "Creating…" : "Create Countdown"}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1e2d3d]">All Countdowns</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-12 text-red-500 text-sm">{loadError}</div>
        ) : countdowns.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No countdowns created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Active</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {countdowns.map(c => {
                  const status = getStatus(c);
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-[#1e2d3d] font-semibold max-w-[10rem]">
                        <p className="truncate" title={c.title}>{c.title}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(c.start_at).toLocaleString("en-GH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(c.end_at).toLocaleString("en-GH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ToggleSwitch
                          active={c.is_active}
                          disabled={togglingId === c.id}
                          onToggle={() => handleToggleActive(c)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(c)} className="text-xs font-semibold text-[#F2AA25] hover:underline">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(c)} className="text-xs font-semibold text-red-500 hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingCountdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingCountdown(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-4">Edit Countdown</h3>

            <div className="mb-3">
              <label className={labelClass}>Title</label>
              <input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className={labelClass}>Start Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={editForm.start_at}
                  onChange={e => setEditForm(f => ({ ...f, start_at: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={editForm.end_at}
                  onChange={e => setEditForm(f => ({ ...f, end_at: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            {editError && (
              <p className="text-xs text-red-500 font-medium mb-3">{editError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setEditingCountdown(null)}
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
