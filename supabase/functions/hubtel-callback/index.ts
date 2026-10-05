// @ts-nocheck
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function dbFetch(supabaseUrl, supabaseKey, path, method = "GET", body = null) {
  const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    method,
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=minimal" : "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (method === "GET" || method === "PATCH") {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return []; }
  }
  return null;
}

// Ask Hubtel (via the payment proxy) for the real status of a transaction.
// Returns { paid, amount } — callback bodies are unauthenticated, so this is the check that counts.
async function hubtelStatus(clientReference) {
  const proxyUrl = Deno.env.get("PROXY_URL");
  const proxySecret = Deno.env.get("PROXY_SECRET");
  if (!proxyUrl || !proxySecret) return { paid: false, amount: null, error: "proxy not configured" };
  const res = await fetch(`${proxyUrl}/status?${new URLSearchParams({ clientReference })}`, {
    headers: { "X-Proxy-Key": proxySecret, "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  const raw = data.Data ?? data.data;
  const tx = Array.isArray(raw) ? raw[0] : raw;
  const status = String(tx?.TransactionStatus ?? tx?.InvoiceStatus ?? tx?.Status ?? tx?.status ?? "");
  const amount = Number(tx?.TransactionAmount ?? tx?.Amount ?? tx?.amount);
  return { paid: /^(paid|success|successful|completed)$/i.test(status), amount: Number.isFinite(amount) ? amount : null, status };
}

// Apply a Hubtel-confirmed shipping payment (marks exactly the lines it covered as paid).
async function finalizeShippingPayment(supabaseUrl, supabaseKey, ref, amount) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_shipping_payment`, {
    method: "POST",
    headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_ref: ref, p_paid_amount: amount }),
  });
  return res.ok ? await res.json() : `error ${res.status}: ${await res.text()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const rawText = await req.text().catch(() => "");
  console.log("[hubtel-callback] Received:", req.method, rawText);

  let payload = {};
  try { payload = JSON.parse(rawText); } catch {}

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // 1. Log the raw callback for audit purposes
  if (supabaseUrl && supabaseKey) {
    await fetch(`${supabaseUrl}/rest/v1/hubtel_callback_log`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ payload, received_at: new Date().toISOString() }),
    }).catch((e) => console.error("[hubtel-callback] DB log failed:", e.message));
  }

  // 2. Attempt to create the order if payment was successful
  if (supabaseUrl && supabaseKey) {
    try {
      const orderId =
        payload.ClientReference ?? payload.clientReference ??
        payload.Data?.ClientReference ?? payload.data?.clientReference ?? "";
      const txStatus = (
        payload.TransactionStatus ?? payload.transactionStatus ??
        payload.Status ?? payload.status ?? ""
      ).toLowerCase();
      const isSuccess = txStatus === "completed" || txStatus === "success";

      if (isSuccess && orderId.startsWith("ORD-")) {
        // Idempotency: skip if order already exists
        const existing = await dbFetch(supabaseUrl, supabaseKey,
          `/orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id&limit=1`);

        if (!Array.isArray(existing) || existing.length === 0) {
          // Fetch the pending order saved by CheckoutPage before payment
          const pending = await dbFetch(supabaseUrl, supabaseKey,
            `/pending_orders?order_id=eq.${encodeURIComponent(orderId)}&limit=1`);

          if (Array.isArray(pending) && pending.length > 0) {
            const p = pending[0];
            const form = p.form_data;
            const items = p.items;

            const activePeriodRows = await dbFetch(supabaseUrl, supabaseKey,
              `/order_periods?is_active=eq.true&select=id&limit=1`);
            const activePeriodId = Array.isArray(activePeriodRows) && activePeriodRows.length
              ? activePeriodRows[0].id : null;

            const orderRows = items.map(item => ({
              order_id:          orderId,
              customer_id:       p.customer_id,
              product_id:        item.id,
              quantity:          item.quantity,
              unit_price:        item.unit_price,
              cost_price:        item.cost_price  ?? 0,
              profit:            item.profit      ?? 0,
              rmb_price:         item.rmb_price   ?? 0,
              misc_amount:       item.misc_amount ?? 0,
              size:              item.size   ?? null,
              colour:            item.colour ?? null,
              status:            "Ordered",
              delivery_region:   form.region,
              delivery_town:     form.town,
              can_edit_delivery: true,
              order_period_id:   activePeriodId,
            }));

            const invoiceRows = items.map(item => ({
              invoice_id:    orderId,
              customer_name: form.fullName,
              product_name:  item.product_name,
              size:          item.size   ?? null,
              colour:        item.colour ?? null,
              quantity:      item.quantity,
              unit_price:    item.unit_price,
              total:         item.unit_price * item.quantity,
              order_period_id: activePeriodId,
            }));

            await dbFetch(supabaseUrl, supabaseKey, "/orders", "POST", orderRows);
            await dbFetch(supabaseUrl, supabaseKey, "/invoices", "POST", invoiceRows);
            await dbFetch(supabaseUrl, supabaseKey,
              `/pending_orders?order_id=eq.${encodeURIComponent(orderId)}`,
              "PATCH", { processed_at: new Date().toISOString() });

            if (p.coupon_id) {
              await dbFetch(supabaseUrl, supabaseKey, "/rpc/confirm_coupon_usage", "POST", {
                p_coupon_id: p.coupon_id,
                p_order_id: orderId,
              });
            }

            console.log("[hubtel-callback] Order created:", orderId);
          } else {
            console.warn("[hubtel-callback] No pending_order found for:", orderId);
          }
        } else {
          console.log("[hubtel-callback] Order already exists (idempotent):", orderId);
        }
      }
    } catch (err) {
      console.error("[hubtel-callback] Order creation failed:", err.message);
    }

    // 3. Shipping fee payments (SHP-…): confirm with Hubtel itself, then apply.
    try {
      const ref =
        payload.ClientReference ?? payload.clientReference ??
        payload.Data?.ClientReference ?? payload.data?.clientReference ?? "";
      if (ref.startsWith("SHP-")) {
        const verified = await hubtelStatus(ref);
        if (verified.paid) {
          const result = await finalizeShippingPayment(supabaseUrl, supabaseKey, ref, verified.amount);
          console.log("[hubtel-callback] Shipping payment", ref, "→", result);
        } else {
          console.warn("[hubtel-callback] Shipping payment not confirmed by Hubtel:", ref, verified.status ?? verified.error);
        }
      }
    } catch (err) {
      console.error("[hubtel-callback] Shipping payment handling failed:", err.message);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
