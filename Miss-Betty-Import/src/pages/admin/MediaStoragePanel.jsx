import { useState } from "react";
import { mediaAdmin } from "../../lib/media";

// One-time move of existing product media from Supabase Storage to Cloudflare R2, plus
// clean-up tools: delete the old Supabase copies, and sweep R2 files no product uses.
export default function MediaStoragePanel({ onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(null); // { moved, remaining, total }
  const [confirm, setConfirm] = useState(null);    // { kind: 'cleanup'|'sweep', count }

  const add = (type, text) => setLog(l => [...l.slice(-30), { type, text, at: new Date().toLocaleTimeString() }]);

  async function moveAll() {
    setBusy("migrate");
    let movedTotal = 0;
    const failed = new Set();
    try {
      for (let round = 0; round < 200; round++) {
        const r = await mediaAdmin.migrate(8);
        movedTotal += r.moved;
        r.errors.forEach(e => { if (!failed.has(e.product_id)) add("error", `Product #${e.product_id}: ${e.error}`); failed.add(e.product_id); });
        setProgress({ moved: movedTotal, remaining: r.remaining, total: r.total });
        // Stop when done, or when only products that keep failing are left.
        if (r.remaining === 0 || (r.moved === 0 && r.errors.length > 0)) break;
      }
      add(failed.size ? "warn" : "ok", `Moved media for ${movedTotal} product(s) to Cloudflare R2.${failed.size ? ` ${failed.size} product(s) need attention.` : ""}`);
      onChanged?.();
    } catch (err) {
      add("error", err.message);
    }
    setBusy("");
  }

  async function check(kind) {
    setBusy(kind);
    try {
      const r = kind === "cleanup" ? await mediaAdmin.cleanup(true) : await mediaAdmin.sweep(true);
      const count = kind === "cleanup" ? r.deletable : r.orphans;
      add("ok", kind === "cleanup"
        ? `${count} old Supabase cop${count === 1 ? "y" : "ies"} of moved media can be deleted.`
        : `${count} unused file(s) on R2 (older than 24 hours).`);
      if (count > 0) setConfirm({ kind, count });
    } catch (err) {
      add("error", err.message);
    }
    setBusy("");
  }

  async function runDelete() {
    const { kind, count } = confirm;
    setConfirm(null);
    setBusy(kind);
    try {
      const r = kind === "cleanup" ? await mediaAdmin.cleanup(false) : await mediaAdmin.sweep(false);
      add(r.errors?.length ? "warn" : "ok", `Deleted ${r.deleted} of ${count} file(s).${r.errors?.length ? ` Problems: ${r.errors.join("; ")}` : ""}`);
    } catch (err) {
      add("error", err.message);
    }
    setBusy("");
  }

  const btn = "px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40";
  return (
    <div className="bg-white rounded-2xl shadow-sm mb-6">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3 text-left">
        <span>
          <span className="text-sm font-bold text-[#1e2d3d]">Media storage</span>
          <span className="text-xs text-gray-400 ml-2">Cloudflare R2 · move existing media and clean up unused files</span>
        </span>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#1e2d3d] mb-1">1. Move existing media to R2</p>
              <p className="text-[11px] text-gray-500 mb-2">Copies every product image (and any uploaded video) from Supabase to R2 and updates the products. Safe to run again; finished products are skipped.</p>
              <button onClick={moveAll} disabled={!!busy} className={`${btn} bg-[#1e2d3d] text-white hover:opacity-90`}>
                {busy === "migrate" ? "Moving…" : "Move media to R2"}
              </button>
              {progress && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#F2AA25]" style={{ width: `${(progress.moved / Math.max(1, progress.moved + progress.remaining)) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{progress.moved} moved · {progress.remaining} still on Supabase</p>
                </div>
              )}
            </div>
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#1e2d3d] mb-1">2. Delete old Supabase copies</p>
              <p className="text-[11px] text-gray-500 mb-2">After checking the shop looks right, remove the Supabase copies of media that now lives on R2. Only copies no product uses are deleted.</p>
              <button onClick={() => check("cleanup")} disabled={!!busy} className={`${btn} border border-gray-300 text-gray-700 hover:border-gray-400`}>
                {busy === "cleanup" ? "Checking…" : "Check old copies"}
              </button>
            </div>
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#1e2d3d] mb-1">Clean up unused R2 files</p>
              <p className="text-[11px] text-gray-500 mb-2">Finds files on R2 that no product uses (older than 24 hours) so storage doesn't fill up with leftovers.</p>
              <button onClick={() => check("sweep")} disabled={!!busy} className={`${btn} border border-gray-300 text-gray-700 hover:border-gray-400`}>
                {busy === "sweep" ? "Checking…" : "Find unused files"}
              </button>
            </div>
          </div>

          {confirm && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-yellow-800">
                Delete {confirm.count} {confirm.kind === "cleanup" ? "old Supabase cop" + (confirm.count === 1 ? "y" : "ies") : "unused R2 file(s)"}? This can't be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(null)} className={`${btn} border border-gray-300 text-gray-600 bg-white`}>Cancel</button>
                <button onClick={runDelete} className={`${btn} bg-red-500 text-white hover:bg-red-600`}>Delete</button>
              </div>
            </div>
          )}

          {log.length > 0 && (
            <ul className="text-xs space-y-1 max-h-48 overflow-y-auto bg-gray-50 rounded-xl p-3">
              {log.map((l, i) => (
                <li key={i} className={l.type === "error" ? "text-red-600" : l.type === "warn" ? "text-yellow-700" : "text-green-700"}>
                  <span className="text-gray-400">{l.at}</span> {l.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
