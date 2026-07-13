// @ts-nocheck
function normalizeHubtelStatus(raw) {
  if (!raw || typeof raw !== "object") return raw;

  const responseCode = raw.ResponseCode ?? raw.responseCode;
  const message      = raw.Message      ?? raw.message;

  // Data may be an array (RMSC) or an object — take the first element if array
  const dataRaw = raw.Data ?? raw.data;
  const tx = Array.isArray(dataRaw) ? dataRaw[0] : dataRaw;

  const result = {};
  if (responseCode !== undefined) result.responseCode = responseCode;
  if (message      !== undefined) result.message      = message;

  if (tx && typeof tx === "object") {
    result.data = {
      status:                tx.TransactionStatus  ?? tx.InvoiceStatus   ?? tx.status,
      date:                  tx.StartDate          ?? tx.Date             ?? tx.date,
      clientReference:       tx.ClientReference    ?? tx.clientReference,
      transactionId:         tx.TransactionId      ?? tx.transactionId,
      externalTransactionId: tx.NetworkTransactionId ?? tx.ExternalTransactionId ?? tx.externalTransactionId,
      paymentMethod:         tx.PaymentMethod      ?? tx.paymentMethod,
      currencycode:          tx.CurrencyCode       ?? tx.currencycode,
      amount:                tx.TransactionAmount  ?? tx.Amount           ?? tx.amount,
      charges:               tx.Fee                ?? tx.Charges          ?? tx.charges,
      amountAfterCharges:    tx.AmountAfterFees    ?? tx.AmountAfterCharges ?? tx.amountAfterCharges,
      isFulfilled:           tx.IsFulfilled        ?? tx.isFulfilled,
    };
    // Strip undefined entries so the dashboard doesn't render blank rows
    Object.keys(result.data).forEach(k => {
      if (result.data[k] === undefined || result.data[k] === null) delete result.data[k];
    });
  }

  return Object.keys(result).length > 0 ? result : raw;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    console.log("[check-payment-status] Incoming request:", req.method, req.url);

    const body = await req.json().catch(() => ({}));
    console.log("[check-payment-status] Request body:", JSON.stringify(body));

    const { clientReference } = body;

    if (!clientReference) {
      return new Response(
        JSON.stringify({ error: "clientReference (Order ID) is required" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log("[check-payment-status] clientReference:", clientReference);

    const proxyUrl    = Deno.env.get("PROXY_URL");
    const proxySecret = Deno.env.get("PROXY_SECRET");

    if (!proxyUrl || !proxySecret) {
      const missing = [!proxyUrl && "PROXY_URL", !proxySecret && "PROXY_SECRET"].filter(Boolean).join(", ");
      return new Response(
        JSON.stringify({ error: `Payment service not configured — missing: ${missing}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams({ clientReference });
    const url = `${proxyUrl}/status?${params}`;
    console.log("[check-payment-status] Fetching via proxy:", url);

    let hubtelRes;
    try {
      hubtelRes = await fetch(url, {
        method: "GET",
        headers: {
          "X-Proxy-Key": proxySecret,
          "Content-Type": "application/json",
        },
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return new Response(
        JSON.stringify({ error: `Cannot reach payment service: ${msg}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let rawText = "";
    try { rawText = await hubtelRes.text(); } catch {}
    console.log("Hubtel response:", hubtelRes.status, rawText);

    if (!rawText.trim()) {
      return new Response(
        JSON.stringify({ error: "Hubtel returned an empty response. The transaction may not exist or the Order ID may not match." }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let data = {};
    try { data = JSON.parse(rawText); } catch {
      console.error("Hubtel non-JSON:", hubtelRes.status, rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: `Hubtel returned non-JSON (HTTP ${hubtelRes.status}): ${rawText.slice(0, 200)}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log("[check-payment-status] Parsed Hubtel data:", JSON.stringify(data));

    if (Object.keys(data).length === 0) {
      return new Response(
        JSON.stringify({ error: "No transaction data returned. Check that the Order ID is correct." }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!hubtelRes.ok) {
      const errMsg = data.message ?? data.Message ?? data.error ?? `Hubtel error (HTTP ${hubtelRes.status})`;
      console.error("Hubtel status error:", hubtelRes.status, rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: errMsg, ...data }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log("[check-payment-status] Returning success response");
    return new Response(
      JSON.stringify(normalizeHubtelStatus(data)),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("Unhandled error:", msg);
    return new Response(
      JSON.stringify({ error: `Unhandled: ${msg}` }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
