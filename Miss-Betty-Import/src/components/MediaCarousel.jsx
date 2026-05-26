import { useState, useEffect, useCallback } from "react";

const SLIDE_INTERVAL = 4000;

// ── Icons ─────────────────────────────────────────────────────────────────
const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ExpandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const TikTokIcon = () => (
  <svg width="52" height="52" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34.1 6C34.7 9.4 36.6 12.2 39.5 13.9v6.3c-2.5.1-4.9-.5-7.1-1.6v14.1c0 7-5.7 12.7-12.7 12.7S7 39.7 7 32.7s5.7-12.7 12.7-12.7c.5 0 1 0 1.5.1v6.5c-.5-.1-1-.2-1.5-.2-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5 6.5-2.9 6.5-6.5V6h7.9z" fill="white"/>
  </svg>
);

const ImagePlaceholder = ({ heightClass }) => (
  <div className={`w-full ${heightClass} bg-gray-100 flex items-center justify-center`}>
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
      fill="none" stroke="#d1d5db" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  </div>
);

async function triggerDownload(url, filename) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const tmp  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = tmp;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(tmp);
  } catch {
    window.open(url, "_blank");
  }
}

/**
 * media:       array of { type: 'image' | 'tiktok', url: string }
 * heightClass: tailwind height classes, e.g. "h-56 sm:h-72"
 * name:        base filename used for downloads (e.g. product name)
 */
export default function MediaCarousel({ media, heightClass = "h-56 sm:h-72", name = "media" }) {
  const items = media.filter(m => m.url);

  const [idx,      setIdx]      = useState(0);
  const [hovered,  setHovered]  = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [autoKey,  setAutoKey]  = useState(0); // bumped on manual nav to reset the timer

  // Auto-slide: runs every SLIDE_INTERVAL ms unless hovered.
  // autoKey dependency means any manual navigation resets the countdown.
  useEffect(() => {
    if (items.length <= 1 || hovered) return;
    const timer = setInterval(() => {
      setIdx(i => (i + 1) % items.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [items.length, hovered, autoKey]);

  // Manual navigation resets the auto-slide timer via autoKey
  const goTo = useCallback((newIdx) => {
    setIdx(newIdx);
    setAutoKey(k => k + 1);
  }, []);

  const prev = () => goTo((idx - 1 + items.length) % items.length);
  const next = () => goTo((idx + 1) % items.length);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") setLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  if (items.length === 0) return <ImagePlaceholder heightClass={heightClass} />;

  const item     = items[idx];
  const btnClass = "bg-black/50 hover:bg-black/75 text-white rounded-lg p-1.5 transition-colors flex items-center justify-center";

  return (
    <>
      <div
        className="relative w-full overflow-hidden bg-black"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Slide ── */}
        {item.type === "image" ? (
          <img
            src={item.url}
            alt={name}
            className={`w-full ${heightClass} object-cover`}
          />
        ) : (
          /* TikTok slide — full-area link, opens TikTok app on mobile via universal links */
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full ${heightClass} flex flex-col items-center justify-center bg-black gap-3`}
            onClick={e => e.stopPropagation()}
          >
            <TikTokIcon />
            <span className="text-white font-bold text-sm tracking-wide">Watch on TikTok</span>
          </a>
        )}

        {/* ── Prev / Next arrows ── */}
        {items.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full p-1.5 transition-colors z-10"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white rounded-full p-1.5 transition-colors z-10"
            >
              <ChevronRight />
            </button>
          </>
        )}

        {/* ── Action buttons (images only) ── */}
        {item.type === "image" && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
            <button
              title="Expand"
              aria-label="Expand image"
              onClick={() => setLightbox(true)}
              className={btnClass}
            >
              <ExpandIcon />
            </button>
            <button
              title="Download"
              aria-label="Download image"
              onClick={() => triggerDownload(item.url, `${name}-${idx + 1}.jpg`)}
              className={btnClass}
            >
              <DownloadIcon />
            </button>
          </div>
        )}

        {/* ── Dot indicators — bottom-center ── */}
        {items.length > 1 && (
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
            {items.map((m, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{ pointerEvents: "auto" }}
                className={`rounded-full transition-all duration-300 ${
                  i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Slide counter — top-right ── */}
        {items.length > 1 && (
          <span className="absolute top-2.5 right-2.5 bg-black/40 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10 select-none">
            {idx + 1} / {items.length}
          </span>
        )}

        {/* ── Auto-slide progress bar ── */}
        {items.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-10">
            <div
              key={`${idx}-${autoKey}-${hovered}`}
              className={`h-full bg-white/70 ${hovered ? "" : "animate-progress"}`}
              style={{ width: hovered ? "0%" : undefined }}
            />
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && item.type === "image" && (
        <div
          className="fixed inset-0 z-[60] bg-black/92 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          {/* Download button */}
          <button
            onClick={(e) => { e.stopPropagation(); triggerDownload(item.url, `${name}-${idx + 1}.jpg`); }}
            className="absolute top-4 left-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Download image"
          >
            <DownloadIcon />
          </button>

          {/* Close button */}
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>

          <img
            src={item.url}
            alt={name}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Progress bar keyframe ── */}
      <style>{`
        @keyframes progress {
          from { width: 0% }
          to   { width: 100% }
        }
        .animate-progress {
          animation: progress ${SLIDE_INTERVAL}ms linear forwards;
        }
      `}</style>
    </>
  );
}
