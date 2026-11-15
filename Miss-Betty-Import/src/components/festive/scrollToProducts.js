// Smoothly brings the product grid (<main>) up under the sticky header.
export function scrollToProducts() {
  const main = document.querySelector("main");
  if (!main) return;
  const header = document.querySelector("header")?.offsetHeight ?? 0;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: main.getBoundingClientRect().top + window.scrollY - header - 4, behavior: reduce ? "auto" : "smooth" });
}
