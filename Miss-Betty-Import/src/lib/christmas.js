// Christmas Animations: the wording and hero photo live in app_settings (key "christmas_mode")
// as JSON text. Words wrapped in *stars* show in yellow.
export const CHRISTMAS_DEFAULT_PHOTO = "/festive/christmas-hero.webp";

export const CHRISTMAS_DEFAULTS = {
  strip: "Christmas Special: Get up to *50% OFF* on selected items!",
  headline: "Shopping *Made Better!*",
  message: "Get amazing deals, festive offers and more this Christmas at Miss Betty Import.",
  photo: "",
};
export const CHRISTMAS_LIMITS = { strip: 90, headline: 60, message: 140 };

// The first version's default wording; a row still holding it gets the current defaults.
const LEGACY_HEADLINE = "Merry Christmas from Miss Betty Import";

const str = (v, fallback) => (typeof v === "string" ? v : fallback);

export function parseChristmasText(text) {
  try {
    const j = JSON.parse(text ?? "");
    if (!j || typeof j !== "object" || (j.headline === LEGACY_HEADLINE && j.strip == null)) return { ...CHRISTMAS_DEFAULTS };
    return {
      strip: str(j.strip, CHRISTMAS_DEFAULTS.strip),
      headline: str(j.headline, "").trim() ? j.headline : CHRISTMAS_DEFAULTS.headline,
      message: str(j.message, CHRISTMAS_DEFAULTS.message),
      photo: /^(https:\/\/|\/)/.test(str(j.photo, "")) ? j.photo : "",
    };
  } catch {
    return { ...CHRISTMAS_DEFAULTS };
  }
}

// "Shopping *Made Better!*" -> [{ text: "Shopping ", hi: false }, { text: "Made Better!", hi: true }]
export function highlightParts(text) {
  return String(text ?? "").split(/(\*[^*]+\*)/).filter(Boolean).map(part =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2
      ? { text: part.slice(1, -1), hi: true }
      : { text: part.replace(/\*/g, ""), hi: false });
}

export const plainText = text => highlightParts(text).map(p => p.text).join("");
