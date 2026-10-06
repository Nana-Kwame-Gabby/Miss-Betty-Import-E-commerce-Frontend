// Invoice/receipt PDF attached to order confirmation emails (A4, one or more pages).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";

export type InvoiceData = {
  orderId: string;
  date: string;            // already formatted, Ghana time
  customerName: string;
  email: string;
  phone?: string | null;
  delivery?: string | null;
  items: { name: string; detail?: string; qty: number; unit: number; total: number }[];
  subtotal: number;
  discount: number;
  shippingNote: string;
  total: number;
  status: string;
};

const NAVY = rgb(0.118, 0.176, 0.239);
const AMBER = rgb(0.949, 0.667, 0.145);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.9, 0.91, 0.93);

// The standard PDF fonts only cover Latin-1; replace anything else so a product name with
// an emoji or unusual symbol can't break the invoice.
const safe = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u20B5/g, "GHS ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
const ghs = (n: number) => `GHS ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) cur = next;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${d.orderId}`);
  pdf.setAuthor("Miss Betty Import");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 48;
  const right = W - M;

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const text = (t: string, x: number, yy: number, size = 10, f = font, color = NAVY) =>
    page.drawText(safe(t), { x, y: yy, size, font: f, color });
  const textR = (t: string, xr: number, yy: number, size = 10, f = font, color = NAVY) =>
    page.drawText(safe(t), { x: xr - f.widthOfTextAtSize(safe(t), size), y: yy, size, font: f, color });

  // Header band
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 100, width: W, height: 4, color: AMBER });
  text("Miss Betty Import", M, H - 52, 20, bold, rgb(1, 1, 1));
  text("www.missbettyimport.com  \u00B7  WhatsApp +233 20 269 7541", M, H - 72, 9, font, rgb(0.85, 0.87, 0.9));
  textR("INVOICE / RECEIPT", right, H - 52, 14, bold, AMBER);
  textR(d.orderId, right, H - 72, 10, font, rgb(1, 1, 1));
  y = H - 136;

  // Billed to / details
  text("BILLED TO", M, y, 8, bold, GREY);
  text("ORDER DETAILS", 330, y, 8, bold, GREY);
  y -= 16;
  const left = [d.customerName, d.email, d.phone ?? "", d.delivery ?? ""].filter(Boolean);
  const rightRows: [string, string][] = [["Order number", d.orderId], ["Date", d.date], ["Status", d.status], ["Payment", "Paid via Hubtel"]];
  for (let i = 0; i < Math.max(left.length, rightRows.length); i++) {
    if (left[i]) text(left[i], M, y, 10, i === 0 ? bold : font);
    if (rightRows[i]) { text(rightRows[i][0], 330, y, 9, font, GREY); textR(rightRows[i][1], right, y, 9, bold); }
    y -= 15;
  }
  y -= 14;

  // Items table
  const cols = { item: M, qty: 340, unit: 440, total: right };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: right - M, height: 22, color: rgb(0.97, 0.98, 0.99) });
    text("ITEM", cols.item + 6, y, 8, bold, GREY);
    textR("QTY", cols.qty + 12, y, 8, bold, GREY);
    textR("UNIT PRICE", cols.unit + 30, y, 8, bold, GREY);
    textR("TOTAL", cols.total - 6, y, 8, bold, GREY);
    y -= 24;
  };
  header();
  for (const it of d.items) {
    const nameLines = wrap(it.name, bold, 10, 270);
    const detailLines = it.detail ? wrap(it.detail, font, 8.5, 270) : [];
    const rowH = nameLines.length * 13 + detailLines.length * 11 + 10;
    if (y - rowH < 160) { page = pdf.addPage([W, H]); y = H - M; header(); }
    // y is the baseline of the row's first line; the separator sits under its last line.
    let last = y;
    nameLines.forEach((l, i) => { last = y - i * 13; text(l, cols.item + 6, last, 10, bold); });
    detailLines.forEach((l, i) => { last = y - nameLines.length * 13 - i * 11 + 2; text(l, cols.item + 6, last, 8.5, font, GREY); });
    textR(String(it.qty), cols.qty + 12, y, 10);
    textR(ghs(it.unit), cols.unit + 30, y, 10);
    textR(ghs(it.total), cols.total - 6, y, 10, bold);
    const lineY = last - 8;
    page.drawLine({ start: { x: M, y: lineY }, end: { x: right, y: lineY }, thickness: 0.7, color: LINE });
    y = lineY - 16;
  }

  // Totals
  y -= 2;
  const totalRow = (label: string, value: string, strong = false) => {
    const vSize = strong ? 12 : 10;
    const valueStart = right - 6 - bold.widthOfTextAtSize(safe(value), vSize);
    textR(label, Math.min(440, valueStart - 14), y, strong ? 11 : 10, strong ? bold : font, strong ? NAVY : GREY);
    textR(value, right - 6, y, vSize, bold);
    y -= strong ? 20 : 16;
  };
  totalRow("Subtotal", ghs(d.subtotal));
  if (d.discount > 0) totalRow("Coupon discount", `- ${ghs(d.discount)}`);
  totalRow("Shipping", d.shippingNote);
  page.drawLine({ start: { x: 300, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 1.2, color: NAVY });
  y -= 4;
  totalRow("Total paid", ghs(d.total), true);

  // Footer
  const foot = "Thank you for shopping with Miss Betty Import. Keep this receipt for your records.";
  page.drawLine({ start: { x: M, y: 70 }, end: { x: right, y: 70 }, thickness: 0.7, color: LINE });
  text(foot, M, 54, 9, font, GREY);
  text("Questions about this order? WhatsApp +233 20 269 7541 or visit missbettyimport.com", M, 40, 9, font, GREY);

  return await pdf.save();
}
