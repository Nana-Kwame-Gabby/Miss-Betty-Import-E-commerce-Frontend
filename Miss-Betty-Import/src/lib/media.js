import { supabase } from "./supabase";

// Product media on Cloudflare R2, via the admin-only /api/media endpoint (api/media.js).
// Files upload straight from the browser to R2 using short-lived signed links.

const MB = 1024 * 1024;
export const MEDIA_RULES = {
  image:  { max: 10 * MB,  types: ["image/jpeg", "image/png", "image/webp", "image/gif"], label: "JPG, PNG, WebP or GIF" },
  video:  { max: 200 * MB, types: ["video/mp4", "video/webm", "video/quicktime"],          label: "MP4, WebM or MOV" },
};
export const MAX_EXTRA_IMAGES = 8;
export const MAX_VIDEOS = 3;

// Error message for a file that can't be uploaded, or null when it's fine.
export function validateFile(file, kind) {
  const rule = MEDIA_RULES[kind];
  if (!rule.types.includes(file.type)) return `"${file.name}" isn't allowed. Use ${rule.label}.`;
  if (file.size > rule.max) return `"${file.name}" is ${(file.size / MB).toFixed(1)} MB; the limit is ${rule.max / MB} MB.`;
  return null;
}

// Resize to at most 1600 px and re-encode as WebP (~80% quality). GIFs (may be animated)
// and files that wouldn't get smaller are kept as they are.
export async function compressImage(file, maxSide = 1600, quality = 0.8) {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(r => canvas.toBlob(r, "image/webp", quality));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

// A still frame from a video (about 1 s in) as a JPEG, used as its thumbnail/poster.
// The video is attached (invisibly) and loaded explicitly: iPhones/Safari often don't load
// a detached video at all, which would leave the product without a thumbnail.
export function capturePoster(file, maxWidth = 960) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let finished = false;
    const done = (result) => {
      if (finished) return;
      finished = true;
      video.removeAttribute("src");
      video.load();
      video.remove();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    video.src = url;
    video.onerror = () => done(null);
    let seeking = false;
    const seek = () => {
      if (seeking) return;
      seeking = true;
      video.currentTime = Math.min(1, (video.duration || 2) / 4);
    };
    video.onloadedmetadata = seek;
    video.onloadeddata = seek;
    video.load();
    video.onseeked = () => {
      try {
        const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round((video.videoWidth || 640) * scale);
        canvas.height = Math.round((video.videoHeight || 360) * scale);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => done(b ? new File([b], "poster.jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.8);
      } catch {
        done(null);
      }
    };
    setTimeout(() => done(null), 15000);
  });
}

async function callMedia(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Media service error (${res.status})`);
  return data;
}

function putWithProgress(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload of "${file.name}" failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error(`Upload of "${file.name}" failed. Check your connection and try again.`));
    xhr.send(file);
  });
}

// Uploads [{ file, kind: 'image'|'video'|'poster' }] and returns their public URLs, in order.
// onProgress(fraction 0..1) covers all files together, weighted by size.
export async function uploadMedia(items, onProgress) {
  if (!items.length) return [];
  const signed = await callMedia({ action: "sign", files: items.map(i => ({ kind: i.kind, type: i.file.type, size: i.file.size })) });
  const total = items.reduce((s, i) => s + i.file.size, 0) || 1;
  const done = items.map(() => 0);
  const report = () => onProgress?.(items.reduce((s, it, i) => s + it.file.size * done[i], 0) / total);
  await Promise.all(items.map((it, i) =>
    putWithProgress(signed[i].uploadUrl, it.file, signed[i].headers, (f) => { done[i] = f; report(); })
  ));
  return signed.map(s => s.publicUrl);
}

// Deletes files we host on R2. Never throws: a failed delete leaves a file for the sweep.
export async function deleteMedia(urls) {
  const list = [...new Set(urls.filter(Boolean))];
  if (!list.length) return;
  try { await callMedia({ action: "delete", urls: list }); } catch (err) { console.warn("[media] delete failed:", err.message); }
}

export const mediaAdmin = {
  migrate: (batch) => callMedia({ action: "migrate", batch }),
  cleanup: (dryRun = true) => callMedia({ action: "cleanup", dryRun }),
  sweep: (dryRun = true) => callMedia({ action: "sweep", dryRun }),
};
