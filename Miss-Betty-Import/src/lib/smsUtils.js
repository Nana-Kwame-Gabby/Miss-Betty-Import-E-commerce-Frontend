export const SMS_MAX_CHARS = 320;

export function smsSegments(len) {
  if (len <= 160) return 1;
  if (len <= 320) return 2;
  return Math.ceil(len / 153);
}
