import { Link } from "react-router-dom";

// Navy footer band shared by Shop and Home (DESIGN.md "Footer"), with WhatsApp's real icon.
export default function ShopFooter() {
  return (
    <footer className="bg-mbi-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28 sm:pb-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="text-base font-semibold">Miss Betty Import</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Miss Betty Import is a duly registered business with the Office of the Registrar of Companies,
              Republic of Ghana, under the Registration of Business Names Act, 1962 (Act 151).
            </p>
          </div>
          <a
            href="https://wa.me/233202697541"
            target="_blank"
            rel="noopener noreferrer"
            className="mbi-press inline-flex h-11 w-fit items-center gap-2 rounded-full bg-mbi-whatsapp px-5 text-sm font-semibold text-mbi-navy hover:brightness-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4ZM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/>
            </svg>
            Chat on WhatsApp
          </a>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Policies" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/contact" className="text-white/80 hover:text-white hover:underline">Contact us</Link>
            <Link to="/terms" className="text-white/80 hover:text-white hover:underline">Terms and conditions</Link>
            <Link to="/privacy-policy" className="text-white/80 hover:text-white hover:underline">Privacy policy</Link>
          </nav>
          <p className="text-white/60">© {new Date().getFullYear()} Miss Betty Import. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
