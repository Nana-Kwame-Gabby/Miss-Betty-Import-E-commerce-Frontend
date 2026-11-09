import { useEffect } from "react";
import { downloadImage } from "../../lib/downloadImage";

// Full-screen photo on the navy scrim (opened from a product card's full-screen button).
export default function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const control = "mbi-press absolute top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `${alt} photo` : "Product photo"}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f1720]/95 p-4 transition-opacity duration-200 starting:opacity-0"
      onClick={onClose}
    >
      <button type="button" onClick={e => downloadImage(e, src, alt)} className={`${control} left-4`} title="Download image" aria-label="Download image">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button type="button" onClick={onClose} className={`${control} right-4`} aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img src={src} alt={alt} className="max-h-[90vh] max-w-full rounded-mbi-card object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}
