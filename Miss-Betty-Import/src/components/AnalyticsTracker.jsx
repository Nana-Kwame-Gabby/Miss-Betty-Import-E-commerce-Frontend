import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Privacy-friendly page-view tracking (see api/track.js and the Privacy Policy).
// - Visitor: a random id in localStorage, not linked to any account. A refresh or a return
//   visit from the same browser is the same visitor.
// - Session (visit): ends after 30 minutes of inactivity.
// - No cookies; respects Do Not Track / Global Privacy Control; admins aren't tracked.

const VISITOR_KEY = "mbi_vid";
const SESSION_KEY = "mbi_sess";
const LAST_KEY = "mbi_last_view";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const REPEAT_MS = 30 * 1000;
// Pages that only redirect elsewhere; the destination page is what gets counted.
const SKIP = [/^\/admin/, /^\/product\//, /^\/auth\/callback/, /^\/home$/];

const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
const write = (store, key, value) => { try { window[store].setItem(key, value); } catch { /* storage blocked */ } };

function newId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const b = window.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function optedOut() {
  const dnt = navigator.doNotTrack ?? window.doNotTrack ?? navigator.msDoNotTrack;
  return dnt === "1" || dnt === "yes" || navigator.globalPrivacyControl === true;
}

function trackPageView(path) {
  if (import.meta.env.DEV || optedOut() || SKIP.some(re => re.test(path))) return;
  const now = Date.now();

  // A refresh (or the same page twice in a row) within 30s is one view.
  const [lastPath, lastAt] = (read("sessionStorage", LAST_KEY) ?? "").split("|");
  if (lastPath === path && now - Number(lastAt) < REPEAT_MS) return;
  write("sessionStorage", LAST_KEY, `${path}|${now}`);

  let visitor = read("localStorage", VISITOR_KEY);
  if (!visitor) { visitor = newId(); write("localStorage", VISITOR_KEY, visitor); }

  let session = null;
  try { session = JSON.parse(read("localStorage", SESSION_KEY) ?? "null"); } catch { /* corrupt */ }
  const firstOfSession = !session?.id || now - Number(session.at) > SESSION_IDLE_MS;
  if (firstOfSession) session = { id: newId() };
  write("localStorage", SESSION_KEY, JSON.stringify({ id: session.id, at: now }));

  let utm = "";
  try { utm = new URLSearchParams(window.location.search).get("utm_source") ?? ""; } catch { /* ignore */ }

  const body = JSON.stringify({
    v: visitor,
    s: session.id,
    p: path,
    f: firstOfSession ? 1 : 0,
    r: firstOfSession ? document.referrer : "",
    u: firstOfSession ? utm.slice(0, 60) : "",
    t: navigator.maxTouchPoints > 1 ? 1 : 0,
  });

  // fetch+keepalive (survives the page closing). sendBeacon is only a fallback: on the live
  // site, beacons sent after in-app navigation were observed never to arrive.
  const send = () => {
    try {
      fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } })
        .catch(() => { try { navigator.sendBeacon?.("/api/track", body); } catch { /* ignore */ } });
    } catch { /* never let analytics break the page */ }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(send, { timeout: 3000 });
  else setTimeout(send, 1000);
}

export default function AnalyticsTracker() {
  const { pathname } = useLocation();
  const { loading, isAdmin } = useAuth();

  useEffect(() => {
    if (loading || isAdmin) return;
    trackPageView(pathname);
  }, [pathname, loading, isAdmin]);

  return null;
}
