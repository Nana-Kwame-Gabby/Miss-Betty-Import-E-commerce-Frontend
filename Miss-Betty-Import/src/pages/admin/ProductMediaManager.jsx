import { useState } from "react";
import { MAX_EXTRA_IMAGES, MAX_VIDEOS, capturePoster, validateFile } from "../../lib/media";
import { compressVideo } from "../../lib/videoCompress";

// Product media editor (images, videos, TikTok link) shared by the Add form and the Edit modal.
// State helpers and upload logic live in lib/productMedia.js.

let videoSeq = 0;
function newVideoSlot(file) {
  return {
    id: `video-${++videoSeq}`,
    file, originalSize: file.size, preview: URL.createObjectURL(file),
    posterFile: null, posterPreview: null, compressing: true, progress: 0, note: "",
  };
}

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_VIDEOS = "video/mp4,video/webm,video/quicktime";
const btn = "bg-gray-100 hover:bg-gray-200 text-[#1e2d3d] font-semibold text-[11px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer";

function ImageTile({ label, slot, onPick, onRemove, removable = true }) {
  const src = slot?.preview ?? slot?.url;
  return (
    <div className="border border-gray-200 rounded-xl p-2 flex flex-col items-center gap-1.5 min-w-0">
      <span className="text-[11px] font-semibold text-[#1e2d3d] truncate max-w-full">{label}</span>
      {src ? (
        <div className="relative">
          <img src={src} alt={label} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
          {slot?.file && <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold bg-[#F2AA25] text-white px-1 rounded">NEW</span>}
          {removable && (
            <button type="button" onClick={onRemove} title="Remove image"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
          )}
        </div>
      ) : (
        <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-300 text-[10px]">No image</div>
      )}
      <label className={btn}>
        <input type="file" accept={ACCEPT_IMAGES} className="hidden" onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) onPick(f); }} />
        {src ? "Replace" : "Choose"}
      </label>
    </div>
  );
}

export default function ProductMediaManager({ value, onChange, tiktokUrl, onTiktokChange, inputClass, disabled = false }) {
  const [problem, setProblem] = useState("");

  const check = (file, kind) => {
    const err = validateFile(file, kind);
    setProblem(err ?? "");
    return !err;
  };
  const imageSlot = (file) => ({ file, preview: URL.createObjectURL(file) });
  const set = (patch) => onChange(prev => ({ ...prev, ...patch }));

  const patchVideo = (id, patch) =>
    onChange(prev => ({ ...prev, videos: prev.videos.map(v => (v.id === id ? { ...v, ...patch } : v)) }));

  // A picked video: thumbnail from the original, then compressed to 720p (~1.2 Mbps) so
  // customers on mobile data can watch it smoothly. Saving waits while compressing.
  async function prepareVideo(slot) {
    capturePoster(slot.file).then(poster => {
      if (poster) patchVideo(slot.id, { posterFile: poster, posterPreview: URL.createObjectURL(poster) });
    });
    const result = await compressVideo(slot.file, p => patchVideo(slot.id, { progress: p }));
    const mb = (n) => (n / 1024 / 1024).toFixed(1);
    patchVideo(slot.id, {
      file: result.file,
      compressing: false,
      note: result.compressed ? `Optimized: ${mb(slot.originalSize)} MB → ${mb(result.file.size)} MB` : result.reason,
      noteOk: result.compressed,
    });
  }

  async function addVideos(files) {
    const room = MAX_VIDEOS - value.videos.length;
    const slots = [...files].filter(f => check(f, "video")).slice(0, room).map(newVideoSlot);
    if (!slots.length) return;
    onChange(prev => ({ ...prev, videos: [...prev.videos, ...slots] }));
    for (const slot of slots) await prepareVideo(slot); // one at a time: encoding is heavy
  }

  async function replaceVideo(index, file) {
    if (!check(file, "video")) return;
    const slot = newVideoSlot(file);
    onChange(prev => ({ ...prev, videos: prev.videos.map((v, i) => (i === index ? slot : v)) }));
    await prepareVideo(slot);
  }

  return (
    <fieldset disabled={disabled} className="sm:col-span-2 space-y-4">
      <div>
        <p className="text-xs font-bold text-[#1e2d3d] uppercase tracking-wide">Product Media</p>
        <p className="text-[11px] text-gray-400">
          Customers see: {value.videos.length ? "Video → " : ""}Image 1 → Image 2 → more images{tiktokUrl ? " → TikTok link" : ""}.
          Images are compressed automatically before upload.
        </p>
      </div>

      {problem && <p className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl px-3 py-2">{problem}</p>}

      {/* Images */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Images <span className="font-normal">(JPG, PNG, WebP or GIF, up to 10 MB each)</span></p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <ImageTile label="Image 1 (Main)" slot={value.main} removable={!value.main?.url}
            onPick={f => check(f, "image") && set({ main: imageSlot(f) })} onRemove={() => set({ main: null })} />
          <ImageTile label="Image 2" slot={value.second}
            onPick={f => check(f, "image") && set({ second: imageSlot(f) })} onRemove={() => set({ second: null })} />
          {value.extras.map((s, i) => (
            <ImageTile key={s.url ?? s.preview} label={`Image ${i + 3}`} slot={s}
              onPick={f => check(f, "image") && set({ extras: value.extras.map((x, j) => (j === i ? imageSlot(f) : x)) })}
              onRemove={() => set({ extras: value.extras.filter((_, j) => j !== i) })} />
          ))}
          {value.extras.length < MAX_EXTRA_IMAGES && (
            <label className="border border-dashed border-gray-300 rounded-xl p-2 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#F2AA25] hover:text-[#F2AA25] cursor-pointer min-h-[132px]">
              <input type="file" accept={ACCEPT_IMAGES} multiple className="hidden" onChange={e => {
                const files = [...e.target.files].filter(f => check(f, "image")).slice(0, MAX_EXTRA_IMAGES - value.extras.length);
                e.target.value = "";
                if (files.length) set({ extras: [...value.extras, ...files.map(imageSlot)] });
              }} />
              <span className="text-2xl leading-none">+</span>
              <span className="text-[11px] font-semibold text-center">Add images</span>
              <span className="text-[10px]">{value.extras.length}/{MAX_EXTRA_IMAGES}</span>
            </label>
          )}
        </div>
      </div>

      {/* Videos */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">
          Videos <span className="font-normal">(optional · MP4, WebM or MOV, up to 200 MB · optimized automatically · shown first on the product page)</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {value.videos.map((v, i) => (
            <div key={v.id ?? v.url} className="border border-gray-200 rounded-xl p-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#1e2d3d]">Video {i + 1}{v.file ? " · new" : ""}</span>
                {v.file && !v.compressing && <span className="text-[10px] text-gray-400">{(v.file.size / 1024 / 1024).toFixed(1)} MB</span>}
              </div>
              {v.compressing && (
                <div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#F2AA25] transition-all" style={{ width: `${Math.round((v.progress ?? 0) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Optimizing for fast playback… {Math.round((v.progress ?? 0) * 100)}%</p>
                </div>
              )}
              {!v.compressing && v.note && (
                <p className={`text-[10px] ${v.noteOk ? "text-green-600" : "text-yellow-700"}`}>{v.note}</p>
              )}
              <video src={v.preview ?? v.url} poster={v.posterPreview ?? v.poster_url ?? undefined}
                controls playsInline preload="metadata" className="w-full h-36 bg-black rounded-lg object-contain" />
              {v.file && !v.posterFile && <span className="text-[10px] text-gray-400">Creating thumbnail…</span>}
              <div className="flex gap-1.5">
                <label className={btn}>
                  <input type="file" accept={ACCEPT_VIDEOS} className="hidden" onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) replaceVideo(i, f); }} />
                  Replace
                </label>
                <button type="button" onClick={() => set({ videos: value.videos.filter((_, j) => j !== i) })}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[11px] px-2.5 py-1 rounded-lg">Remove</button>
              </div>
            </div>
          ))}
          {value.videos.length < MAX_VIDEOS && (
            <label className="border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#F2AA25] hover:text-[#F2AA25] cursor-pointer min-h-[120px]">
              <input type="file" accept={ACCEPT_VIDEOS} multiple className="hidden" onChange={e => { const files = [...e.target.files]; e.target.value = ""; addVideos(files); }} />
              <span className="text-2xl leading-none">▶</span>
              <span className="text-[11px] font-semibold">Add video</span>
              <span className="text-[10px]">{value.videos.length}/{MAX_VIDEOS}</span>
            </label>
          )}
        </div>
      </div>

      {/* TikTok */}
      <div>
        <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">TikTok Video Link <span className="text-gray-400 font-normal">(optional)</span></label>
        <input type="url" value={tiktokUrl} onChange={e => onTiktokChange(e.target.value)}
          placeholder="https://www.tiktok.com/@user/video/..." className={inputClass} />
      </div>
    </fieldset>
  );
}
