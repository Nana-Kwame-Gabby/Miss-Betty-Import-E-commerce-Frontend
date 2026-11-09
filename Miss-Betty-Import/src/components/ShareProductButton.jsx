import { useState } from "react";
import { photoButtonClass, photoIconClass } from "../lib/photoButton";

// Small circular photo control (DESIGN.md icon-button-circle); styles in lib/photoButton.js.
export default function ShareProductButton({ productId, productName, productPrice, originalPrice = null, isFromPrice = false, positionClassName = "top-1.5 right-1.5 sm:top-2 sm:right-2" }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e) {
    e.stopPropagation();
    const url = `${window.location.origin}/product/${productId}`;
    // ~text~ renders as strikethrough in WhatsApp and stays readable elsewhere
    const saleSuffix = originalPrice != null
      ? ` (was ~GHS ${Number(originalPrice).toLocaleString()}~)`
      : "";
    const priceLine = `Price: ${isFromPrice ? "From " : ""}GHS ${Number(productPrice ?? 0).toLocaleString()}${saleSuffix}`;
    const message = `Product Name: ${productName}\n${priceLine}\nLink: ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: productName, text: message });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing to do
    }
  }

  return (
    <div className={`absolute ${positionClassName}`}>
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Share ${productName}`}
        title="Share product"
        className={photoButtonClass}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={photoIconClass}>
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
      {copied && (
        <span role="status" className="absolute top-full right-0 mt-1.5 whitespace-nowrap bg-mbi-navy text-white text-xs font-semibold px-2.5 py-1 rounded-full">
          Link copied
        </span>
      )}
    </div>
  );
}
