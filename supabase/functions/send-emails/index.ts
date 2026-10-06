// Email sender for Miss Betty Import.
//
// action "process": sends due emails from the email_messages outbox. Called by the database
//   (pg_net right after an email is queued, plus a 5-minute pg_cron sweep) with the worker
//   secret, or by an admin. Each email is built from fresh data, sent via Brevo, and its
//   outcome recorded; failures are retried with back-off by the database.
// action "preview": admin only; returns the HTML of an announcement before it is sent.
//
// Secrets: BREVO_API_KEY, EMAIL_FROM ("Miss Betty Import <orders@missbettyimport.com>"),
// EMAIL_REPLY_TO (optional). Until BREVO_API_KEY is set, emails simply wait in the outbox.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { orderEmail, orderShippingNote, periodEmail, shippingEmail, sourcedEmail, type Built } from "./emails.ts";
import { ghanaTime, toText } from "./templates.ts";
import { buildInvoicePdf } from "./invoice-pdf.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const TIME_BUDGET_MS = 45_000;
const BATCH = 20;

class PermanentError extends Error {}

type Msg = {
  id: number; kind: string; recipient: string; recipient_name: string | null; customer_id: number | null;
  subject: string | null; data: Record<string, unknown>; campaign_id: number | null; is_test: boolean;
};

// ── Data loading (service role) ──────────────────────────────────────────────────
const lineName = (o: { product_name_snapshot?: string | null; products?: { product_name?: string } | null }) =>
  o.products?.product_name ?? o.product_name_snapshot ?? "Product";
const variant = (size?: string | null, colour?: string | null) =>
  [size && `Size: ${size}`, colour && `Colour: ${colour}`].filter(Boolean).join(" · ");

async function buildOrder(db: SupabaseClient, m: Msg): Promise<Built> {
  const orderId = String(m.data.order_id ?? "");
  const [{ data: lines, error }, { data: pend }, { data: cust }] = await Promise.all([
    db.from("orders")
      .select("id, order_id, quantity, unit_price, size, colour, status, product_type, created_at, product_name_snapshot, products(product_name)")
      .eq("order_id", orderId).order("id"),
    db.from("pending_orders").select("form_data, discount_amount").eq("order_id", orderId).maybeSingle(),
    db.from("customers").select("customer_name, email, telephone").eq("customer_id", m.customer_id).maybeSingle(),
  ]);
  if (error) throw new Error(`Loading order failed: ${error.message}`);
  if (!lines?.length) throw new PermanentError(`Order ${orderId} not found`);

  const items = lines.map(l => ({
    name: lineName(l as never),
    detail: variant(l.size, l.colour) || undefined,
    qty: Number(l.quantity),
    unit: Number(l.unit_price),
    total: Number(l.unit_price) * Number(l.quantity),
    type: l.product_type as string | null,
  }));
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = Math.min(Number(pend?.discount_amount ?? 0), subtotal);
  const form = (pend?.form_data ?? {}) as Record<string, string>;
  const name = form.fullName || cust?.customer_name || m.recipient_name || "";
  const delivery = [form.town, form.region].filter(Boolean).join(", ") || null;
  const createdAt = lines[0].created_at as string;
  const status = String(lines[0].status ?? "Ordered");

  const built = orderEmail({ orderId, createdAt, customerName: name, items, subtotal, discount, total: subtotal - discount, status, delivery });
  const pdf = await buildInvoicePdf({
    orderId, date: ghanaTime(createdAt), customerName: name, email: m.recipient,
    phone: form.phone || cust?.telephone || null, delivery,
    items, subtotal, discount, shippingNote: orderShippingNote(items), total: subtotal - discount, status,
  });
  let bin = "";
  for (let i = 0; i < pdf.length; i += 0x8000) bin += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
  built.attachments = [{ name: `Invoice-${orderId}.pdf`, content: btoa(bin) }];
  return built;
}

async function buildShipping(db: SupabaseClient, m: Msg): Promise<Built> {
  const ref = String(m.data.shp_ref ?? "");
  const { data: req, error } = await db.from("shipping_payment_requests")
    .select("shp_ref, amount, lines, paid_at, paid_amount, status").eq("shp_ref", ref).maybeSingle();
  if (error) throw new Error(`Loading payment failed: ${error.message}`);
  if (!req || req.status !== "paid") throw new PermanentError(`Payment ${ref} not found or not paid`);
  const reqLines = (req.lines ?? []) as { line_id: number; quantity: number; fee_per_item: number; amount: number; size: string | null }[];
  const { data: orderLines } = await db.from("orders")
    .select("id, order_id, size, colour, product_name_snapshot, products(product_name)")
    .in("id", reqLines.map(l => l.line_id));
  const byId = new Map((orderLines ?? []).map(o => [o.id, o]));
  const items = reqLines.map(l => {
    const o = byId.get(l.line_id);
    return {
      name: o ? lineName(o as never) : "Product",
      detail: [variant(o?.size ?? l.size, o?.colour), o?.order_id && `Order ${o.order_id}`].filter(Boolean).join(" · ") || undefined,
      qty: Number(l.quantity),
      unit: Number(l.fee_per_item),
      total: Number(l.amount),
    };
  });
  const { data: cust } = await db.from("customers").select("customer_name").eq("customer_id", m.customer_id).maybeSingle();
  return shippingEmail({
    ref, customerName: cust?.customer_name ?? m.recipient_name ?? "", paidAt: req.paid_at,
    items, amount: Number(req.amount), charged: req.paid_amount != null ? Number(req.paid_amount) : null,
  });
}

function priceLabel(p: { unit_price: number | string; discount_price: number | string | null; size_pricing: { selling_price?: number; discount_price?: number | null }[] | null }) {
  const sp = Array.isArray(p.size_pricing) && p.size_pricing.length ? p.size_pricing : null;
  const fmt = (n: number) => `GHS ${n.toLocaleString("en-GB")}`;
  if (sp) {
    const prices = sp.map(r => Number(r.discount_price ?? r.selling_price ?? 0)).filter(n => n > 0);
    return prices.length ? `From ${fmt(Math.min(...prices))}` : undefined;
  }
  const unit = Number(p.unit_price ?? 0);
  const disc = p.discount_price != null ? Number(p.discount_price) : null;
  return disc != null && disc > 0 && disc < unit ? `${fmt(disc)} (was ${fmt(unit)})` : unit > 0 ? fmt(unit) : undefined;
}

async function buildSourced(db: SupabaseClient, m: Msg): Promise<Built> {
  const id = String(m.data.request_id ?? "");
  const { data: r, error } = await db.from("product_requests")
    .select("id, product_name, created_at, status, sourced_product_id, products(product_id, product_name, product_image_url, unit_price, discount_price, size_pricing, archived_at)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Loading request failed: ${error.message}`);
  if (!r) throw new PermanentError(`Request ${id} not found`);
  const prod = r.products as unknown as {
    product_id: number; product_name: string; product_image_url: string | null; archived_at: string | null;
    unit_price: number; discount_price: number | null; size_pricing: never;
  } | null;
  const { data: cust } = await db.from("customers").select("customer_name").eq("customer_id", m.customer_id).maybeSingle();
  return sourcedEmail({
    requestRef: `REQ-${String(r.id).slice(0, 8).toUpperCase()}`,
    requestedName: r.product_name,
    requestedAt: r.created_at,
    customerName: cust?.customer_name ?? m.recipient_name ?? "",
    product: prod && !prod.archived_at
      ? { id: prod.product_id, name: prod.product_name, image: prod.product_image_url, priceLabel: priceLabel(prod) }
      : null,
  });
}

async function buildPeriod(db: SupabaseClient, m: Msg): Promise<Built> {
  let subject = String(m.data.subject ?? m.subject ?? "");
  let message = String(m.data.message ?? "");
  let periodId = (m.data.order_period_id ?? null) as number | null;
  if (m.campaign_id) {
    const { data: c, error } = await db.from("email_campaigns").select("subject, message, order_period_id").eq("id", m.campaign_id).maybeSingle();
    if (error) throw new Error(`Loading announcement failed: ${error.message}`);
    if (!c) throw new PermanentError("Announcement not found");
    ({ subject, message } = c);
    periodId = c.order_period_id;
  }
  let periodName: string | null = null;
  if (periodId) {
    const { data: per } = await db.from("order_periods").select("name").eq("id", periodId).maybeSingle();
    periodName = per?.name ?? null;
  }
  const built = periodEmail({ kind: m.kind as "period_closed" | "period_opened", subject, message, periodName, customerName: m.recipient_name });
  if (m.is_test) built.subject = `[TEST] ${built.subject}`;
  return built;
}

const BUILDERS: Record<string, (db: SupabaseClient, m: Msg) => Promise<Built>> = {
  order_confirmation: buildOrder,
  shipping_payment: buildShipping,
  request_sourced: buildSourced,
  period_closed: buildPeriod,
  period_opened: buildPeriod,
};

// ── Brevo ────────────────────────────────────────────────────────────────────────
function parseFrom(raw: string) {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, "") || "Miss Betty Import", email: m[2].trim() } : { name: "Miss Betty Import", email: raw.trim() };
}

async function sendViaBrevo(m: Msg, built: Built) {
  const apiKey = Deno.env.get("BREVO_API_KEY")!;
  const replyTo = Deno.env.get("EMAIL_REPLY_TO");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseFrom(Deno.env.get("EMAIL_FROM") ?? ""),
      to: [{ email: m.recipient, ...(m.recipient_name ? { name: m.recipient_name.slice(0, 70) } : {}) }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject: built.subject,
      htmlContent: built.html,
      textContent: toText(built.html),
      ...(built.attachments ? { attachment: built.attachments } : {}),
      tags: [m.kind],
      headers: { "X-MBI-Email-Id": String(m.id) },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = `Brevo ${res.status}: ${body.message ?? body.code ?? res.statusText}`;
    // Invalid address etc. won't succeed on retry; auth/quota/server errors might.
    if (res.status === 400 && /email|recipient|invalid/i.test(String(body.message ?? ""))) throw new PermanentError(msg);
    throw new Error(msg);
  }
  return String(body.messageId ?? "");
}

// What Brevo actually delivered: every link and image in the sent email, each fetched to
// check its HTTPS certificate and where it ends up. Used to verify link/image rewriting.
async function brevoGet(path: string) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: { "api-key": Deno.env.get("BREVO_API_KEY")!, accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${body.message ?? res.statusText}`);
  return body;
}

async function probe(url: string) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (MBI email link check)" } });
    await res.body?.cancel();
    return { ok: res.ok, status: res.status, finalUrl: res.url, contentType: res.headers.get("content-type") };
  } catch (err) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 300) };
  }
}

async function inspectDelivered(messageId: string) {
  const list = await brevoGet(`/smtp/emails?messageId=${encodeURIComponent(messageId)}`);
  const uuid = list.transactionalEmails?.[0]?.uuid;
  if (!uuid) throw new Error("Brevo has no stored copy of this email");
  const sent = await brevoGet(`/smtp/emails/${uuid}`);
  const html = String(sent.body ?? "");
  const grab = (re: RegExp) => [...new Set([...html.matchAll(re)].map(m => m[1].replace(/&amp;/g, "&")))].slice(0, 30);
  const check = async (urls: string[]) => Promise.all(urls.map(async url => ({
    url, host: url.match(/^[a-z]+:\/\/([^/?#]+)/i)?.[1] ?? null, ...(await probe(url)),
  })));
  return {
    subject: sent.subject,
    links: await check(grab(/<a\b[^>]*\bhref="([^"]+)"/gi)),
    images: await check(grab(/<img\b[^>]*\bsrc="([^"]+)"/gi)),
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────────
async function processQueue(db: SupabaseClient) {
  const started = Date.now();
  const result = { sent: 0, failed: 0 };
  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: batch, error } = await db.rpc("claim_email_batch", { p_limit: BATCH });
    if (error) throw new Error(`claim failed: ${error.message}`);
    if (!batch?.length) break;
    for (const m of batch as Msg[]) {
      let subject: string | null = null;
      try {
        const builder = BUILDERS[m.kind];
        if (!builder) throw new PermanentError(`Unknown email type ${m.kind}`);
        const built = await builder(db, m);
        subject = built.subject;
        const providerId = await sendViaBrevo(m, built);
        await db.rpc("complete_email", { p_id: m.id, p_ok: true, p_subject: subject, p_provider_id: providerId, p_error: null, p_final: false });
        result.sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[send-emails] #${m.id} ${m.kind} failed:`, msg);
        await db.rpc("complete_email", { p_id: m.id, p_ok: false, p_subject: subject, p_provider_id: null, p_error: msg, p_final: err instanceof PermanentError });
        result.failed++;
      }
    }
  }
  return result;
}

async function isAdmin(db: SupabaseClient, authHeader: string) {
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data } = await db.auth.getUser(jwt);
  return data.user?.app_metadata?.role === "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const secret = req.headers.get("x-worker-secret") ?? "";
  const workerOk = secret ? Boolean((await db.rpc("verify_email_worker_secret", { p_secret: secret })).data) : false;
  const adminOk = !workerOk && await isAdmin(db, req.headers.get("Authorization") ?? "");
  if (!workerOk && !adminOk) return json({ error: "Not allowed" }, 401);

  try {
    if (action === "process") {
      if (!Deno.env.get("BREVO_API_KEY") || !Deno.env.get("EMAIL_FROM")) {
        // Not configured yet: leave everything queued (checked again later).
        const { data: batch } = await db.rpc("claim_email_batch", { p_limit: 100 });
        for (const m of (batch ?? []) as Msg[]) await db.rpc("release_email", { p_id: m.id });
        return json({ configured: false, waiting: batch?.length ?? 0 });
      }
      return json({ configured: true, ...(await processQueue(db)) });
    }

    if (action === "preview" && adminOk) {
      const kind = body.kind === "period_closed" ? "period_closed" : "period_opened";
      const { data: per } = kind === "period_opened"
        ? await db.from("order_periods").select("name").eq("is_active", true).order("opened_at", { ascending: false }).limit(1).maybeSingle()
        : await db.from("order_periods").select("name").eq("is_active", false).not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(1).maybeSingle();
      const built = periodEmail({
        kind, subject: String(body.subject ?? "").slice(0, 150), message: String(body.message ?? "").slice(0, 5000),
        periodName: per?.name ?? null, customerName: "Ama Mensah",
      });
      return json({ subject: built.subject, html: built.html });
    }

    if (action === "inspect") {
      const { data: m } = await db.from("email_messages").select("provider_message_id").eq("id", Number(body.email_id)).maybeSingle();
      if (!m?.provider_message_id) return json({ error: "Email not found or not sent yet" }, 404);
      return json(await inspectDelivered(m.provider_message_id));
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[send-emails] error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
