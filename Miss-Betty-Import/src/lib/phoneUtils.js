const GHANA_PHONE_REGEX = /^(0\d{9}|233\d{9}|\+233\d{9})$/;

export function validateGhanaPhone(raw) {
  const original = (raw ?? "").trim();
  if (!original) return { valid: false, error: "Phone number is empty." };
  const cleaned = original.replace(/[\s-]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) {
    return { valid: false, error: `"${original}" is not a valid phone number (contains letters or symbols).` };
  }
  if (!GHANA_PHONE_REGEX.test(cleaned)) {
    return { valid: false, error: `"${original}" is not a valid phone number (expected 0XXXXXXXXX or 233XXXXXXXXX).` };
  }
  return { valid: true, normalized: normalizeGhanaPhone(cleaned) };
}

export function normalizeGhanaPhone(cleaned) {
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return "233" + digits.slice(1);
  return digits;
}

// Splits on comma/semicolon/newline only (not bare spaces, since a single
// Ghana number is often formatted with internal spaces, e.g. "024 123 4567").
export function splitManualPhoneInput(raw) {
  return (raw ?? "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}
