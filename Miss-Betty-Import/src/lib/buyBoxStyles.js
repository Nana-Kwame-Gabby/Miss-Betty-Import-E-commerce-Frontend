// Price formatting and button styles shared by the buy box, product pop-up and product page
// (DESIGN.md: primary = amber with navy text, secondary = white with a navy outline).

const NBSP = String.fromCharCode(160); // keeps "GHS" and the amount on one line
export const money = n => `GHS${NBSP}${Number(n ?? 0).toLocaleString()}`;
export const moneyRange = (min, max) => `GHS${NBSP}${Number(min).toLocaleString()}–${Number(max).toLocaleString()}`;

export function primaryButtonClass({ added = false, disabled = false } = {}) {
  return `mbi-press inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold ${
    added ? "bg-mbi-available-tint text-mbi-available"
      : disabled ? "bg-mbi-amber text-mbi-navy opacity-40 cursor-not-allowed"
      : "bg-mbi-amber text-mbi-navy hover:bg-mbi-amber-press"
  }`;
}

// Buy now / Checkout on the product page: the secondary style, but navy with white text on
// phones (owner's decision, matching the product card).
export function buyNowButtonClass({ disabled = false } = {}) {
  return disabled ? secondaryButtonClass({ disabled: true })
    : `${secondaryButtonClass()} max-sm:border-mbi-navy max-sm:bg-mbi-navy max-sm:text-white max-sm:hover:border-mbi-navy max-sm:hover:bg-mbi-navy`;
}

export function secondaryButtonClass({ disabled = false } = {}) {
  return `mbi-press inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border px-6 text-base font-semibold ${
    disabled ? "border-mbi-hairline bg-mbi-surface-soft text-mbi-slate cursor-not-allowed"
      : "border-mbi-navy/25 bg-white text-mbi-navy hover:border-mbi-navy hover:bg-mbi-navy hover:text-white"
  }`;
}
