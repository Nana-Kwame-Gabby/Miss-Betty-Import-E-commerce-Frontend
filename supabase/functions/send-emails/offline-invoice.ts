// Offline-sale invoice: the figures come only from the saved sale (per-unit prices recorded
// by offline_sale_save), so the invoice always matches the Offline Buyers page. Customer-facing:
// regular price, discount, selling price and totals; never cost, profit or misc.
import { SITE, esc, ghanaTime, infoRows, itemTable, layout, money, note, p, totals } from "./templates.ts";
import { buildInvoicePdf } from "./invoice-pdf.ts";
import type { Built } from "./emails.ts";

export type OfflineSale = {
  id: number;
  invoice_number: string;
  buyer_name: string;
  status: string;            // Active | Cancelled
  payment_status: string;    // Paid | Partially paid | Unpaid
  amount_paid: number | string;
  created_at: string;
  updated_at: string;
  offline_sale_items: {
    id: number;
    product_name_snapshot: string;
    size: string | null;
    colour: string | null;
    quantity: number;
    original_price: number | string;
    discount_amount: number | string;
    unit_price: number | string;
  }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => `GHS ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const firstName = (name?: string | null) => String(name ?? "").trim().split(/\s+/)[0] || "there";

export function offlineInvoiceData(s: OfflineSale) {
  const lines = [...s.offline_sale_items].sort((a, b) => a.id - b.id);
  const items = lines.map(l => {
    const unit = Number(l.unit_price), original = Number(l.original_price), disc = Number(l.discount_amount);
    const variant = [l.colour && `Colour: ${l.colour}`, l.size && `Size: ${l.size}`].filter(Boolean).join(" · ");
    const discount = disc > 0 ? `Was ${fmt(original)} · ${fmt(disc)} off each` : "";
    return {
      name: l.product_name_snapshot,
      detail: [variant, discount].filter(Boolean).join(" · ") || undefined,
      qty: Number(l.quantity),
      unit,
      total: r2(unit * Number(l.quantity)),
    };
  });
  const subtotal = r2(lines.reduce((t, l) => t + Number(l.original_price) * Number(l.quantity), 0));
  const discount = r2(lines.reduce((t, l) => t + Number(l.discount_amount) * Number(l.quantity), 0));
  const total = r2(items.reduce((t, i) => t + i.total, 0));
  const paid = r2(Number(s.amount_paid ?? 0));
  const balance = r2(Math.max(total - paid, 0));
  const revised = new Date(s.updated_at).getTime() - new Date(s.created_at).getTime() > 60_000;
  return {
    number: s.invoice_number, buyer: s.buyer_name, date: ghanaTime(s.created_at),
    revised: revised ? ghanaTime(s.updated_at) : null,
    cancelled: s.status === "Cancelled", payment: s.payment_status,
    items, subtotal, discount, total, paid, balance,
  };
}

export type OfflineInvoice = ReturnType<typeof offlineInvoiceData>;

// The site logo (same small copy the emails use), fetched once per function instance.
let logoCache: Promise<Uint8Array | null> | null = null;
function siteLogo() {
  logoCache ??= fetch(`${SITE}/email-logo.png`)
    .then(r => (r.ok ? r.arrayBuffer() : null))
    .then(b => (b ? new Uint8Array(b) : null))
    .catch(() => null);
  return logoCache;
}

export async function offlineInvoicePdf(inv: OfflineInvoice) {
  const totalRows: { label: string; value: string; strong?: boolean }[] = [{ label: "Subtotal", value: fmt(inv.subtotal) }];
  if (inv.discount > 0) totalRows.push({ label: "Discount", value: `- ${fmt(inv.discount)}` });
  totalRows.push({ label: "Total", value: fmt(inv.total), strong: true });
  totalRows.push({ label: "Amount paid", value: fmt(inv.paid) });
  totalRows.push({ label: "Balance due", value: fmt(inv.balance) });
  const detailRows: [string, string][] = [["Invoice number", inv.number], ["Invoice date", inv.date]];
  if (inv.revised) detailRows.push(["Revised", inv.revised]);
  detailRows.push(["Payment", inv.payment]);
  return await buildInvoicePdf({
    orderId: inv.number, date: inv.date, customerName: inv.buyer, items: inv.items,
    subtotal: inv.subtotal, discount: inv.discount, shippingNote: "", total: inv.total, status: inv.payment,
    title: "INVOICE", detailsTitle: "INVOICE DETAILS", detailRows, totalRows,
    stamp: inv.cancelled ? "CANCELLED" : null,
    footer: "Thank you for shopping with Miss Betty Import. Please keep this invoice for your records.",
    logoPng: await siteLogo(),
  });
}

export function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function offlineInvoiceEmail(inv: OfflineInvoice): Built {
  const paidColor = inv.payment === "Paid" ? "#047857" : inv.payment === "Unpaid" ? "#b91c1c" : "#b45309";
  const rows: [string, string][] = [["Subtotal", money(inv.subtotal)]];
  if (inv.discount > 0) rows.push(["Discount", `− ${money(inv.discount)}`]);
  rows.push(["Amount paid", money(inv.paid)]);
  rows.push([inv.balance > 0 ? "Balance due" : "Total", money(inv.balance > 0 ? inv.balance : inv.total)]);

  const body = `
    ${p(`Hi ${esc(firstName(inv.buyer))},`)}
    ${p("Thank you for your purchase from Miss Betty Import. Your invoice is attached to this email as a PDF, and a summary is below.")}
    ${infoRows([
      ["Invoice number", esc(inv.number)],
      ["Invoice date", esc(inv.date)],
      ["Total amount", esc(money(inv.total))],
      ["Payment", `<span style="color:${paidColor};">${esc(inv.payment)}</span>`],
    ])}
    ${itemTable(inv.items)}
    ${totals(rows)}
    ${inv.balance > 0 ? note(`<strong>Balance due: ${esc(money(inv.balance))}.</strong> Please contact us on WhatsApp to arrange payment.`) : ""}
    ${p("If you have any questions about this invoice, reply to this email or chat with us on WhatsApp.")}
    ${p("Kind regards,<br><strong>Miss Betty Import</strong>")}
  `;
  return {
    subject: `Invoice ${inv.number} – Miss Betty Import`,
    html: layout({
      title: "Your invoice",
      preheader: `Invoice ${inv.number} · ${money(inv.total)} · ${inv.payment}. The PDF is attached.`,
      body,
      badge: inv.payment === "Paid" ? "Paid" : undefined,
      footerNote: "You received this email because you made a purchase from Miss Betty Import.",
    }),
  };
}
