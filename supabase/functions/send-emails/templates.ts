// Miss Betty Import email templates: one shared responsive layout (table-based, inline
// styles, so it renders in Gmail, Outlook and phone mail apps) plus reusable blocks.
// Every piece of customer/admin text goes through esc().

export const SITE = "https://www.missbettyimport.com";
// 192×192 copy of the site logo (public/email-logo.png): ~9 KB instead of the 2400 px original.
const LOGO = `${SITE}/email-logo.png`;
const NAVY = "#1e2d3d";
const AMBER = "#F2AA25";
const MUTED = "#6b7280";
const WHATSAPP = "https://wa.me/233202697541";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const money = (n: unknown) =>
  `GHS\u00a0${Number(n ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ghanaTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Africa/Accra", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

// Admin-typed text: escaped, with paragraphs and line breaks kept.
export const paragraphs = (text: string) =>
  esc(text.trim())
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

// Light formatting for admin-written bulk emails. Everything is escaped first, so no HTML
// from the admin reaches the email; then: blank line = new paragraph, "- " lines = bullet
// list, **text** = bold, https:// addresses = links.
const P_STYLE = "margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;";
function inline(escaped: string) {
  return escaped
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/https:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, url => `<a href="${url}" target="_blank" style="color:${AMBER};font-weight:bold;word-break:break-all;">${url}</a>`);
}
export function richText(text: string) {
  return esc(text.replace(/\r\n/g, "\n").trim())
    .split(/\n{2,}/)
    .map(block => {
      // Within a paragraph, consecutive "- " lines become one bullet list.
      const html: string[] = [];
      let text: string[] = [];
      let items: string[] = [];
      const flushText = () => { if (text.length) html.push(`<p style="${P_STYLE}">${text.map(inline).join("<br>")}</p>`); text = []; };
      const flushList = () => {
        if (items.length) html.push(`<ul style="margin:0 0 14px;padding-left:22px;">${
          items.map(i => `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#374151;">${inline(i)}</li>`).join("")
        }</ul>`);
        items = [];
      };
      for (const line of block.split("\n")) {
        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        if (bullet) { flushText(); items.push(bullet[1]); } else { flushList(); text.push(line); }
      }
      flushText(); flushList();
      return html.join("");
    })
    .join("");
}

export const p = (html: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${html}</p>`;

export const button = (label: string, href: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 6px;">
    <tr><td align="center" bgcolor="${AMBER}" style="border-radius:10px;">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
    </td></tr>
  </table>`;

// Label/value rows, e.g. Order number, Date, Status.
export const infoRows = (rows: [string, string][]) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;background:#f8fafc;border-radius:10px;">
    ${rows.map(([k, v], i) => `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:${MUTED};${i ? "border-top:1px solid #eef0f3;" : ""}">${esc(k)}</td>
        <td align="right" style="padding:10px 14px;font-size:14px;font-weight:bold;color:${NAVY};${i ? "border-top:1px solid #eef0f3;" : ""}">${v}</td>
      </tr>`).join("")}
  </table>`;

export type ItemRow = { name: string; detail?: string; qty: number; unit: number; total: number };

// Invoice-style item table. On phones the columns stay readable (product name wraps).
export const itemTable = (items: ItemRow[], unitLabel = "Price") => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;border-collapse:collapse;">
    <tr>
      <th align="left"  style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${MUTED};border-bottom:2px solid ${NAVY};">Item</th>
      <th align="center" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${MUTED};border-bottom:2px solid ${NAVY};">Qty</th>
      <th align="right" class="hide-sm" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${MUTED};border-bottom:2px solid ${NAVY};">${esc(unitLabel)}</th>
      <th align="right" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${MUTED};border-bottom:2px solid ${NAVY};">Total</th>
    </tr>
    ${items.map(it => `
      <tr>
        <td style="padding:10px 6px;font-size:14px;color:${NAVY};border-bottom:1px solid #eef0f3;">
          <strong>${esc(it.name)}</strong>${it.detail ? `<br><span style="font-size:12px;color:${MUTED};">${esc(it.detail)}</span>` : ""}<span class="show-sm" style="display:none;max-height:0;overflow:hidden;font-size:12px;color:${MUTED};">${it.qty} × ${money(it.unit)}</span>
        </td>
        <td align="center" style="padding:10px 6px;font-size:14px;color:${NAVY};border-bottom:1px solid #eef0f3;">${it.qty}</td>
        <td align="right" class="hide-sm" style="padding:10px 6px;font-size:13px;color:#374151;border-bottom:1px solid #eef0f3;white-space:nowrap;">${money(it.unit)}</td>
        <td align="right" style="padding:10px 6px;font-size:14px;font-weight:bold;color:${NAVY};border-bottom:1px solid #eef0f3;white-space:nowrap;">${money(it.total)}</td>
      </tr>`).join("")}
  </table>`;

// Totals block under an item table. The last row is emphasised.
export const totals = (rows: [string, string][]) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
    ${rows.map(([k, v], i) => {
      const last = i === rows.length - 1;
      return `<tr>
        <td align="right" style="padding:${last ? "10px" : "4px"} 6px;font-size:${last ? "15px" : "13px"};color:${last ? NAVY : MUTED};${last ? `font-weight:bold;border-top:2px solid ${NAVY};` : ""}">${esc(k)}</td>
        <td align="right" style="padding:${last ? "10px" : "4px"} 6px;font-size:${last ? "16px" : "14px"};color:${last ? NAVY : "#374151"};font-weight:bold;${last ? `border-top:2px solid ${NAVY};` : ""}">${v}</td>
      </tr>`;
    }).join("")}
  </table>`;

export const note = (html: string) => `
  <div style="margin:0 0 16px;padding:12px 14px;background:#fff8eb;border-left:4px solid ${AMBER};border-radius:6px;font-size:13px;line-height:1.5;color:#7a5a12;">${html}</div>`;

export const productCard = (name: string, image: string | null, href: string, priceLabel?: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px;border:1px solid #eef0f3;border-radius:12px;">
    <tr>
      ${image ? `<td width="120" style="padding:12px;"><a href="${esc(href)}"><img src="${esc(image)}" width="110" alt="${esc(name)}" style="display:block;width:110px;max-width:110px;height:auto;border-radius:8px;border:0;"></a></td>` : ""}
      <td style="padding:12px;">
        <a href="${esc(href)}" style="font-size:16px;font-weight:bold;color:${NAVY};text-decoration:none;">${esc(name)}</a>
        ${priceLabel ? `<p style="margin:6px 0 0;font-size:14px;color:${AMBER};font-weight:bold;">${esc(priceLabel)}</p>` : ""}
      </td>
    </tr>
  </table>`;

// The shared layout every email uses.
export function layout({ title, preheader, body, badge }: { title: string; preheader: string; body: string; badge?: string }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<title>${esc(title)}</title>
<style>
  @media only screen and (max-width:620px){
    .container{width:100% !important;}
    .hide-sm{display:none !important;}
    .show-sm{display:block !important;max-height:none !important;overflow:visible !important;}
    .px{padding-left:18px !important;padding-right:18px !important;}
    h1{font-size:21px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
  <tr><td align="center" style="padding:24px 10px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td align="center" bgcolor="${NAVY}" style="padding:22px 24px;">
        <a href="${SITE}" style="text-decoration:none;">
          <img src="${LOGO}" width="64" height="64" alt="Miss Betty Import" style="display:block;width:64px;height:64px;margin:0 auto 8px;border:0;outline:none;border-radius:12px;color:#ffffff;font-size:13px;font-weight:bold;line-height:64px;text-align:center;">
          <span style="font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:.5px;">Miss Betty Import</span>
        </a>
      </td></tr>
      <tr><td style="height:4px;background:${AMBER};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td class="px" style="padding:28px 32px 8px;">
        ${badge ? `<span style="display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:bold;">${esc(badge)}</span>` : ""}
        <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;color:${NAVY};">${esc(title)}</h1>
        ${body}
      </td></tr>
      <tr><td class="px" style="padding:18px 32px 26px;border-top:1px solid #eef0f3;">
        <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${MUTED};">
          Questions? Chat with us on <a href="${WHATSAPP}" style="color:${AMBER};font-weight:bold;text-decoration:none;">WhatsApp: +233 20 269 7541</a>
        </p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
          <a href="${SITE}" style="color:#9ca3af;">missbettyimport.com</a> · Quality imports, delivered in Ghana.<br>
          You received this email because you have an account with Miss Betty Import.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Plain-text version from the HTML (for mail apps that prefer text, and spam scoring).
export function toText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label.replace(/<[^>]+>/g, "").trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|h1|div|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
