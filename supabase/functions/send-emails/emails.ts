// The five Miss Betty Import emails, built from the shared layout and blocks.
// Builders take plain data (loaded by index.ts) so they can be previewed and tested alone.
import {
  SITE, button, esc, ghanaTime, infoRows, itemTable, layout, money, note, p, paragraphs, productCard, richText, totals,
  type ItemRow,
} from "./templates.ts";

export type Built = { subject: string; html: string; attachments?: { name: string; content: string }[] };

const firstName = (name?: string | null) => esc(String(name ?? "").trim().split(/\s+/)[0] || "there");

// ── 1. Order confirmation ────────────────────────────────────────────────────────
export type OrderEmail = {
  orderId: string;
  createdAt: string;
  customerName: string;
  items: (ItemRow & { type: string | null })[];
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  delivery?: string | null;
};

export function orderShippingNote(items: { type: string | null }[]) {
  const preorder = items.some(i => i.type !== "Available");
  return preorder ? "Paid separately before delivery" : "None";
}

export function orderEmail(o: OrderEmail): Built {
  const preorder = o.items.some(i => i.type !== "Available");
  const rows: [string, string][] = [["Subtotal", money(o.subtotal)]];
  if (o.discount > 0) rows.push(["Coupon discount", `− ${money(o.discount)}`]);
  rows.push(["Shipping fee", orderShippingNote(o.items)]);
  rows.push(["Total paid", money(o.total)]);

  const body = `
    ${p(`Hi ${firstName(o.customerName)},`)}
    ${p("Thank you for shopping with Miss Betty Import! Your payment was received and your order has been placed successfully. Here are your order details.")}
    ${infoRows([
      ["Order number", esc(o.orderId)],
      ["Date & time", esc(ghanaTime(o.createdAt))],
      ["Status", `<span style="color:#047857;">${esc(o.status)} · Paid</span>`],
      ...(o.delivery ? [["Delivery", esc(o.delivery)] as [string, string]] : []),
    ])}
    ${itemTable(o.items)}
    ${totals(rows)}
    ${preorder ? note("<strong>Pre-order items:</strong> the shipping fee for pre-order goods is calculated when they are about to arrive. We'll let you know, and you can pay it on the Shipping Fees page.") : ""}
    ${p("Your invoice is attached to this email as a PDF.")}
    ${button("View My Orders", `${SITE}/my-orders`)}
  `;
  return {
    subject: `Order confirmed – ${o.orderId}`,
    html: layout({ title: "Your order is confirmed", preheader: `Order ${o.orderId} · ${money(o.total)} paid. Thank you for shopping with Miss Betty Import.`, body, badge: "Payment received" }),
  };
}

// ── 2. Shipping fee payment ──────────────────────────────────────────────────────
export type ShippingEmail = {
  ref: string;
  customerName: string;
  paidAt: string;
  items: ItemRow[];
  amount: number;          // shipping fees covered
  charged: number | null;  // total charged by Hubtel (may include its fee)
};

export function shippingEmail(s: ShippingEmail): Built {
  const rows: [string, string][] = [];
  if (s.charged != null && s.charged - s.amount > 0.009) {
    rows.push(["Shipping fees", money(s.amount)]);
    rows.push(["Payment processing fee", money(s.charged - s.amount)]);
    rows.push(["Total charged", money(s.charged)]);
  } else {
    rows.push(["Total paid", money(s.amount)]);
  }
  const body = `
    ${p(`Hi ${firstName(s.customerName)},`)}
    ${p("We've received your shipping fee payment. Thank you! The items below are now marked as paid.")}
    ${infoRows([
      ["Payment reference", esc(s.ref)],
      ["Date & time", esc(ghanaTime(s.paidAt))],
      ["Status", `<span style="color:#047857;">Paid</span>`],
    ])}
    ${itemTable(s.items, "Fee / item")}
    ${totals(rows)}
    ${button("View Shipping Fees", `${SITE}/shipping-fees`)}
  `;
  return {
    subject: `Shipping fee payment received – ${s.ref}`,
    html: layout({ title: "Shipping fee payment received", preheader: `${money(s.charged ?? s.amount)} received for ${s.ref}.`, body, badge: "Payment confirmed" }),
  };
}

// ── 3. Product request sourced ───────────────────────────────────────────────────
export type SourcedEmail = {
  requestRef: string;
  requestedName: string;
  requestedAt: string;
  customerName: string;
  product: { id: number; name: string; image: string | null; priceLabel?: string } | null;
};

export function sourcedEmail(r: SourcedEmail): Built {
  const link = r.product ? `${SITE}/product/${r.product.id}` : `${SITE}/shop`;
  const body = `
    ${p(`Hi ${firstName(r.customerName)},`)}
    ${p(`Good news! The product you asked us to find, <strong>${esc(r.requestedName)}</strong>, has been sourced and is now on the Miss Betty Import website.`)}
    ${r.product ? productCard(r.product.name, r.product.image, link, r.product.priceLabel) : ""}
    ${infoRows([
      ["Request reference", esc(r.requestRef)],
      ["Requested on", esc(ghanaTime(r.requestedAt))],
      ["Status", `<span style="color:#047857;">Sourced</span>`],
    ])}
    ${p("Visit <a href=\"" + SITE + "\" style=\"color:#F2AA25;font-weight:bold;text-decoration:none;\">missbettyimport.com</a> to see it and place your order while it's available.")}
    ${button(r.product ? "View the product" : "Visit the shop", link)}
  `;
  return {
    subject: `Good news! "${r.requestedName}" is now available`,
    html: layout({ title: "Your requested product is here!", preheader: `${r.requestedName} has been sourced and is now on missbettyimport.com.`, body, badge: "Request sourced" }),
  };
}

// ── 4 & 5. Order period announcements ────────────────────────────────────────────
export type PeriodEmail = {
  kind: "period_closed" | "period_opened";
  subject: string;
  message: string;
  periodName: string | null;
  customerName?: string | null;
};

export function periodEmail(e: PeriodEmail): Built {
  const opened = e.kind === "period_opened";
  const title = opened ? "A new order period is now open!" : "The order period has closed";
  const intro = opened
    ? `A new order period${e.periodName ? ` (<strong>${esc(e.periodName)}</strong>)` : ""} has started. You can now visit our website and place your pre-orders.`
    : `The current order period${e.periodName ? ` (<strong>${esc(e.periodName)}</strong>)` : ""} is now closed, and we are no longer taking pre-orders for it. Orders already placed are being processed.`;
  const body = `
    ${p(`Hi ${firstName(e.customerName)},`)}
    ${p(intro)}
    ${e.message.trim() ? `<div style="margin:4px 0 18px;padding:16px 18px;background:#f8fafc;border-radius:12px;border-left:4px solid #1e2d3d;">${paragraphs(e.message)}</div>` : ""}
    ${button(opened ? "Shop now on missbettyimport.com" : "Visit missbettyimport.com", opened ? `${SITE}/shop` : SITE)}
  `;
  return {
    subject: e.subject,
    html: layout({ title, preheader: e.message.trim().slice(0, 120) || title, body, badge: opened ? "Now open" : "Order period closed" }),
  };
}

// ── 6. Bulk email / general announcement ────────────────────────────────────────────
export type AnnouncementEmail = {
  subject: string;
  message: string;
  customerName?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
};

export function announcementEmail(a: AnnouncementEmail): Built {
  const url = a.buttonUrl && /^https:\/\/[^\s<>"]+$/.test(a.buttonUrl) ? a.buttonUrl : SITE;
  const label = a.buttonLabel?.trim() || (url === SITE ? "Visit missbettyimport.com" : "Learn more");
  const plain = a.message.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const body = `
    ${p(`Hi ${firstName(a.customerName)},`)}
    ${richText(a.message)}
    ${button(label, url)}
    ${url !== SITE ? p(`<span style="font-size:13px;color:#6b7280;">Visit us anytime at <a href="${SITE}" style="color:#F2AA25;font-weight:bold;text-decoration:none;">missbettyimport.com</a></span>`) : ""}
  `;
  return {
    subject: a.subject,
    html: layout({ title: a.subject, preheader: plain.slice(0, 120) || a.subject, body }),
  };
}
