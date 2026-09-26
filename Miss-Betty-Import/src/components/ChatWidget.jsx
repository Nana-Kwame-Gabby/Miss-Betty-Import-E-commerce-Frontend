import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// Floating AI shopping assistant. Replies come from the ai-chat Edge Function, which
// grounds answers in the store's policies and live product/order data. The conversation
// lives in sessionStorage, so it survives page navigation but not closing the tab.

const STORAGE_KEY = "mbimport_ai_chat";
const HIDDEN_PREFIXES = ["/admin", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"];
const SUGGESTIONS = [
  "How do pre-orders work?",
  "Show me sneakers under GHS 300",
  "Where is my order?",
  "How do I pay for shipping fees?",
];
const WELCOME = {
  role: "assistant",
  welcome: true,
  content: "Hi! I'm **Betty**, the Miss Betty Import assistant. I can help you find products, explain how ordering, payment and delivery work, and check your orders. What can I help you with?",
};

// Attention nudge on the chat button: first after 5s, then every 12s, at most 5 per page
// load, and never again once the customer has opened the chat this session.
const OPENED_KEY = "mbimport_ai_chat_opened";
const CHIMED_KEY = "mbimport_ai_chat_chimed";
const SOUND_KEY = "mbimport_ai_chat_sound";
const NUDGE_FIRST_MS = 5000;
const NUDGE_EVERY_MS = 12000;
const NUDGE_MAX = 5;

const readStore = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
const writeStore = (store, key, value) => { try { window[store].setItem(key, value); } catch { /* storage unavailable */ } };

// Soft two-note chime generated in the browser (no audio file). Only ever called with an
// AudioContext created during a user gesture, so browser autoplay rules are respected.
function playChime(ctx) {
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  [[880, 0], [1318.5, 0.12]].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.05, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.25);
  });
}

function loadMessages() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(saved) && saved.length ? saved : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

// ── Safe rendering of the assistant's light formatting (no raw HTML) ─────────────
// Supports **bold**, "- " bullet lists, paragraphs, full URLs and site paths like /shop.
const INLINE = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|(?<![\w/.])\/(?:shop|cart|checkout|my-orders|my-referrals|shipping-fees|product-requests|product\/\d+|contact|terms|privacy-policy|login|signup|forgot-password)\b)/g;

function Inline({ text, onNavigate }) {
  // split() with one capture group puts every match at an odd index.
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (i % 2 === 0) return <span key={i}>{part}</span>;
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("/")) {
      return <Link key={i} to={part} onClick={onNavigate} className="text-[#b37400] underline">{part}</Link>;
    }
    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#b37400] underline break-all">{part}</a>;
  });
}

function FormattedText({ text, onNavigate }) {
  return text.split(/\n{2,}/).map((block, i) => {
    const lines = block.split("\n").filter(l => l.trim());
    if (lines.length && lines.every(l => /^\s*[-•*]\s+/.test(l))) {
      return (
        <ul key={i} className="list-disc pl-4 space-y-0.5 my-1">
          {lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*[-•*]\s+/, "")} onNavigate={onNavigate} /></li>)}
        </ul>
      );
    }
    return (
      <p key={i} className="my-1">
        {lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Inline text={l} onNavigate={onNavigate} /></span>)}
      </p>
    );
  });
}

function ProductCard({ p, onNavigate }) {
  const money = n => `GHS ${Number(n).toLocaleString()}`;
  return (
    <Link
      to={p.url}
      onClick={onNavigate}
      className="flex gap-2.5 bg-white border border-gray-100 rounded-xl p-2 hover:border-[#F2AA25] hover:shadow-sm transition-all"
    >
      {p.image ? (
        <img src={p.image} alt={p.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#1e2d3d] line-clamp-2 leading-snug">{p.name}</p>
        <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
          <span className="text-[#DC2626] font-bold text-sm">{p.price_from ? "From " : ""}{money(p.price)}</span>
          {p.original_price != null && (
            <>
              <span className="text-gray-400 text-[11px] line-through">{money(p.original_price)}</span>
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">SALE</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            p.status === "Available" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>{p.status}</span>
          {!p.in_stock && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Out of stock</span>}
          {(p.sizes.length > 0 || p.colours.length > 0) && (
            <span className="text-[10px] text-gray-400 truncate">
              {[p.sizes.slice(0, 4).join(", "), p.colours.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ChatWidget() {
  const { pathname } = useLocation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [soundOn, setSoundOn] = useState(() => readStore("localStorage", SOUND_KEY) !== "off");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const audioRef = useRef(null);      // AudioContext, created on the visitor's first tap/keypress
  const nudgeCountRef = useRef(0);    // nudges shown since this page load
  const soundOnRef = useRef(soundOn);
  const hidden = HIDDEN_PREFIXES.some(p => pathname.startsWith(p));

  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* storage unavailable */ }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    // On phones/tablets, focusing would pop up the keyboard over the half-height window.
    if (window.innerWidth >= 1024) inputRef.current?.focus();
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Browsers only allow audio after the visitor interacts with the page, so the audio
  // context is created on their first tap or keypress, never before.
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) { try { audioRef.current = new Ctx(); } catch { /* audio unavailable */ } }
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Periodic attention nudge (and at most one chime per session) until the chat is opened.
  useEffect(() => {
    if (open || hidden || readStore("sessionStorage", OPENED_KEY)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let endTimer;
    const nudge = () => {
      if (nudgeCountRef.current >= NUDGE_MAX) return;
      nudgeCountRef.current += 1;
      setNudging(true);
      endTimer = setTimeout(() => setNudging(false), 1000);
      if (soundOnRef.current && audioRef.current && !readStore("sessionStorage", CHIMED_KEY)) {
        writeStore("sessionStorage", CHIMED_KEY, "1");
        try { playChime(audioRef.current); } catch { /* audio unavailable */ }
      }
    };
    let interval;
    const first = setTimeout(() => {
      nudge();
      interval = setInterval(nudge, NUDGE_EVERY_MS);
    }, NUDGE_FIRST_MS);
    return () => { clearTimeout(first); clearInterval(interval); clearTimeout(endTimer); setNudging(false); };
  }, [open, hidden]);

  if (hidden) return null;

  function openChat() {
    writeStore("sessionStorage", OPENED_KEY, "1");
    setOpen(true);
  }

  function toggleSound() {
    const next = !soundOn;
    writeStore("localStorage", SOUND_KEY, next ? "on" : "off");
    setSoundOn(next);
  }

  // On phones the chat covers the page, so close it when a link inside it is followed.
  const onNavigate = () => { if (window.innerWidth < 640) setOpen(false); };

  async function send(text) {
    const content = text.trim().slice(0, 1000);
    if (!content || sending) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setSending(true);
    const history = next
      .filter(m => !m.welcome && !m.error)
      .map(({ role, content }) => ({ role, content }));
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", { body: { messages: history } });
      if (error || data?.error) {
        setMessages(m => [...m, { role: "assistant", error: true, content: data?.error || "Sorry, I couldn't connect. Please check your internet and try again." }]);
      } else {
        setMessages(m => [...m, { role: "assistant", content: data.reply, products: data.products ?? [] }]);
      }
    } catch {
      setMessages(m => [...m, { role: "assistant", error: true, content: "Sorry, I couldn't connect. Please check your internet and try again." }]);
    }
    setSending(false);
  }

  function resetChat() {
    setMessages([WELCOME]);
  }

  const showSuggestions = !messages.some(m => m.role === "user");
  // Sit above the bottom navigation bar, which is shown to logged-in customers.
  const buttonBottom = session ? "bottom-20" : "bottom-5";
  // Phones/tablets (below lg): a half-height portrait window just above the button
  // (button bottom + 44px button + 12px gap), never taller than the space above it.
  // Desktop (lg+) keeps the original 380×560 panel in the bottom-right corner.
  const panelPlacement = session
    ? "bottom-[136px] max-h-[calc(100dvh_-_152px)] min-h-[min(340px,calc(100dvh_-_152px))]"
    : "bottom-[76px] max-h-[calc(100dvh_-_92px)] min-h-[min(340px,calc(100dvh_-_92px))]";

  return (
    <>
      <button
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-label={open ? "Close chat" : "Chat with our shopping assistant"}
        className={`chat-launcher fixed right-4 ${buttonBottom} z-[61] flex items-center gap-2 bg-[#1e2d3d] text-white py-3 rounded-full shadow-lg hover:bg-[#2a3d52] transition-colors ${
          open ? "px-3 lg:hidden" : "pl-3.5 pr-4"
        } ${nudging ? "chat-nudge" : ""}`}
      >
        {nudging && <span aria-hidden="true" className="chat-ring absolute inset-0 rounded-full pointer-events-none" />}
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2AA25" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2AA25" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span className="text-sm font-semibold hidden sm:inline">Ask Betty</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Shopping assistant"
          className={`fixed z-[60] flex flex-col bg-gray-50 overflow-hidden rounded-2xl shadow-2xl border border-gray-200 right-4 ${panelPlacement} w-[min(88vw,340px)] sm:w-[380px] h-[50dvh] lg:bottom-4 lg:w-[380px] lg:h-[560px] lg:min-h-0 lg:max-h-[calc(100vh_-_2rem)]`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 lg:gap-3 lg:px-4 lg:py-3 bg-[#1e2d3d] text-white flex-shrink-0">
            <div className="w-8 h-8 lg:w-9 lg:h-9 flex-shrink-0 rounded-full bg-[#F2AA25] flex items-center justify-center font-bold text-[#1e2d3d]">B</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight truncate"><span className="lg:hidden">Betty · Assistant</span><span className="hidden lg:inline">Betty · Shopping Assistant</span></p>
              <p className="text-[11px] text-gray-300 truncate">AI assistant · can make mistakes</p>
            </div>
            <button
              onClick={toggleSound}
              title={soundOn ? "Mute notification sound" : "Turn on notification sound"}
              aria-label={soundOn ? "Mute notification sound" : "Turn on notification sound"}
              aria-pressed={!soundOn}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                {soundOn
                  ? <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/>
                  : <><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>}
              </svg>
            </button>
            <button onClick={resetChat} title="Start a new chat" className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
              </svg>
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] ${m.role === "user" ? "" : "w-full sm:w-auto"}`}>
                  <div className={`text-sm leading-relaxed px-3 py-2 rounded-2xl ${
                    m.role === "user"
                      ? "bg-[#F2AA25] text-[#1e2d3d] rounded-br-md whitespace-pre-wrap"
                      : m.error
                      ? "bg-red-50 text-red-700 border border-red-100 rounded-bl-md"
                      : "bg-white text-[#1e2d3d] border border-gray-100 rounded-bl-md"
                  }`}>
                    {m.role === "user" ? m.content : <FormattedText text={m.content} onNavigate={onNavigate} />}
                  </div>
                  {m.products?.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.products.map(p => <ProductCard key={p.id} p={p} onNavigate={onNavigate} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start" aria-live="polite">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-3 py-3 flex items-center gap-1">
                  <span className="sr-only">Betty is typing</span>
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {showSuggestions && !sending && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs font-semibold text-[#1e2d3d] bg-white border border-[#F2AA25]/60 hover:bg-[#F2AA25]/10 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 px-3 py-2.5 bg-white border-t border-gray-100 flex-shrink-0"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              maxLength={1000}
              placeholder="Ask Betty a question…"
              className="flex-1 resize-none max-h-28 border border-gray-200 rounded-xl px-3 py-2 text-base lg:text-sm outline-none focus:border-[#F2AA25] transition-colors"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="bg-[#1e2d3d] text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#2a3d52] disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      )}
      {/* One-shot "pop" + ring for the periodic attention nudge; off for reduced motion. */}
      <style>{`
        @keyframes chat-nudge {
          0%   { transform: translateY(0) scale(1); }
          30%  { transform: translateY(-6px) scale(1.15); }
          55%  { transform: translateY(0) scale(0.95); }
          75%  { transform: translateY(-2px) scale(1.04); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes chat-ring {
          from { box-shadow: 0 0 0 0 rgba(242, 170, 37, 0.55); }
          to   { box-shadow: 0 0 0 14px rgba(242, 170, 37, 0); }
        }
        .chat-nudge { animation: chat-nudge 0.9s ease-out; }
        .chat-ring  { animation: chat-ring 1s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .chat-nudge, .chat-ring { animation: none; }
        }
      `}</style>
    </>
  );
}
