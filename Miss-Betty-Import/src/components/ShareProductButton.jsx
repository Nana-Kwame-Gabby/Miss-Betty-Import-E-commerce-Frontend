import { useState } from "react";

export default function ShareProductButton({ productId, productName, productPrice, isFromPrice = false, positionClassName = "top-2 left-2" }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e) {
    e.stopPropagation();
    const url = `${window.location.origin}/product/${productId}`;
    const priceLine = `Price: ${isFromPrice ? "From " : ""}GHS ${Number(productPrice ?? 0).toLocaleString()}`;
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
        onClick={handleShare}
        title="Share product"
        className="bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
      {copied && (
        <span className="absolute top-full left-0 mt-1 whitespace-nowrap bg-[#1e2d3d] text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-sm">
          Copied!
        </span>
      )}
    </div>
  );
}
