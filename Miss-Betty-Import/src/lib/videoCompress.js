// Compresses product videos in the admin's browser before upload: at most 1280 px on the
// long side (720p), H.264 at ~1.2 Mbps with AAC audio, MP4 with the index at the front so
// playback starts before the whole file has downloaded. Phone recordings (often ~15 Mbps,
// 1080p+) shrink ~10x (a 20 s clip is ~3.5 MB), so it plays smoothly on ~2 Mbps mobile data.
//
// Uses the browser's own video encoder (WebCodecs) through Mediabunny, which is loaded only
// when an admin adds a video. Tries the device's (usually hardware) encoder first, then the
// browser's software encoder. Returns { file, compressed, reason } and never throws: if the
// browser can't compress, the original is uploaded instead.

const MAX_SIDE = 1280;
const VIDEO_BITRATE = 1_200_000;
const AUDIO_BITRATE = 96_000;
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

async function convert(mb, file, hardwareAcceleration, onProgress) {
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: (track) => {
      const w = track.displayWidth, h = track.displayHeight;
      const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      return {
        width: even(w * scale), height: even(h * scale), fit: "contain",
        codec: "avc", quality: new mb.Quality({ bitrate: VIDEO_BITRATE }), hardwareAcceleration,
      };
    },
    audio: { codec: "aac", quality: new mb.Quality({ bitrate: AUDIO_BITRATE }) },
  });
  if (!conversion.isValid) return null;
  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();
  return new File([target.buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
}

export async function compressVideo(file, onProgress) {
  if (typeof window === "undefined" || typeof window.VideoEncoder === "undefined") {
    return { file, compressed: false, reason: "This browser can't optimize videos. Chrome or Edge on a computer works best." };
  }
  let mb;
  try {
    mb = await import("mediabunny");
  } catch {
    return { file, compressed: false, reason: "The video optimizer couldn't load; the original will be uploaded." };
  }
  for (const accel of ["no-preference", "prefer-software"]) {
    try {
      onProgress?.(0);
      const out = await convert(mb, file, accel, onProgress);
      if (!out) return { file, compressed: false, reason: "This video's format couldn't be converted in the browser." };
      // Only worth it if it's meaningfully smaller.
      if (out.size >= file.size * 0.9) return { file, compressed: false, reason: "The video was already small." };
      return { file: out, compressed: true };
    } catch (err) {
      console.warn(`[video] compression failed (${accel}):`, err);
    }
  }
  return { file, compressed: false, reason: "The video couldn't be optimized in this browser; the original will be uploaded." };
}
