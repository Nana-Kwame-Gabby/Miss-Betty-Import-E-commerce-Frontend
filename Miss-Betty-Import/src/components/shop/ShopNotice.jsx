import { useEffect, useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";
import CountdownDisplay from "../CountdownBanner";

const key = msg => `mbimport_notice_band:${msg}`;
const seen = msg => { try { return sessionStorage.getItem(key(msg)) === "1"; } catch { return false; } };

// One calm notice band for the Shop and Home pages (DESIGN.md "Notice band"): the admin's
// promo alert and announcement, plus the countdown on phones. Replaces the sliding promo line,
// the marquee and the site-wide banner on these pages. Dismissible for the visit.
// announcementOnly: the other customer pages (product page, cart, …) show just the
// announcement, and only while pre-orders are closed — the same rule as the old site banner.
export default function ShopNotice({ countdownData = null, announcementOnly = false }) {
  const { promoActive, promoMessage, announcementMessage, ordersClosed, setPageShowsNotice } = useAppSettings();
  const messages = announcementOnly
    ? [ordersClosed && announcementMessage].filter(Boolean)
    : [promoActive && promoMessage, announcementMessage].filter(Boolean);
  const text = [...new Set(messages.map(m => m.trim()))].join("  ·  ");
  // The text dismissed in this render tree; a new admin message shows again.
  const [dismissedText, setDismissedText] = useState(null);

  // This page shows the announcement itself, so the site-wide banner stays away.
  useEffect(() => {
    setPageShowsNotice(true);
    return () => setPageShowsNotice(false);
  }, [setPageShowsNotice]);

  const showText = !!text && dismissedText !== text && !seen(text);
  if (!showText && !countdownData) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-2">
      {showText && (
        <div role="status" className="flex items-start gap-3 rounded-mbi-card bg-mbi-amber-tint px-4 py-3 text-mbi-navy">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-mbi-amber-ink">
            <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>
          </svg>
          <p className="flex-1 text-sm font-medium leading-relaxed">{text}</p>
          <button
            type="button"
            onClick={() => { try { sessionStorage.setItem(key(text), "1"); } catch { /* storage unavailable */ } setDismissedText(text); }}
            className="mbi-press -my-1.5 -mr-2 grid shrink-0 place-items-center size-9 rounded-full hover:bg-mbi-navy/10"
            aria-label="Dismiss notice"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
      {countdownData && (
        <div className="lg:hidden">
          <CountdownDisplay data={countdownData} />
        </div>
      )}
    </div>
  );
}
