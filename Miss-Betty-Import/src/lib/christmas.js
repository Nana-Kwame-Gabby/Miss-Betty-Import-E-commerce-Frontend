// Christmas Animations: the banner wording lives in app_settings (key "christmas_mode") as JSON text.
export const CHRISTMAS_DEFAULTS = {
  headline: "Merry Christmas from Miss Betty Import",
  message: "Gifts for everyone you love, delivered across Ghana.",
};
export const CHRISTMAS_LIMITS = { headline: 60, message: 140 };

export function parseChristmasText(text) {
  try {
    const j = JSON.parse(text ?? "");
    return {
      headline: typeof j?.headline === "string" && j.headline.trim() ? j.headline : CHRISTMAS_DEFAULTS.headline,
      message: typeof j?.message === "string" ? j.message : CHRISTMAS_DEFAULTS.message,
    };
  } catch {
    return { ...CHRISTMAS_DEFAULTS };
  }
}
