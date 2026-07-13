// @ts-nocheck
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // Always return HTTP 200 so the SDK always populates fnData.
  // Errors are signalled via { error: "..." } in the body.
  // Success is signalled via { checkoutUrl: "..." }.

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, amount, description, returnUrl, cancellationUrl } = body;

    if (!orderId || !amount || !returnUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: orderId, amount, returnUrl" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const proxyUrl    = Deno.env.get("PROXY_URL");
    const proxySecret = Deno.env.get("PROXY_SECRET");
    const merchantAccount = Deno.env.get("HUBTEL_MERCHANT_ACCOUNT");

    if (!proxyUrl || !proxySecret || !merchantAccount) {
      const missing = [
        !proxyUrl    && "PROXY_URL",
        !proxySecret && "PROXY_SECRET",
        !merchantAccount && "HUBTEL_MERCHANT_ACCOUNT",
      ].filter(Boolean).join(", ");
      console.error("Missing secrets:", missing);
      return new Response(
        JSON.stringify({ error: `Payment service not configured — missing: ${missing}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Call Hubtel via proxy
    let hubtelRes;
    try {
      hubtelRes = await fetch(`${proxyUrl}/initiate`, {
        method: "POST",
        headers: {
          "X-Proxy-Key": proxySecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merchantAccountNumber: merchantAccount,
          clientReference: orderId,
          description: description || `Miss Betty Import — ${orderId}`,
          totalAmount: Number(amount),
          returnUrl,
          cancellationUrl: cancellationUrl || returnUrl,
          callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/hubtel-callback`,
        }),
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("Hubtel fetch failed:", msg);
      return new Response(
        JSON.stringify({ error: `Cannot reach payment service: ${msg}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let rawText = "";
    try {
      rawText = await hubtelRes.text();
    } catch (bodyErr) {
      const msg = bodyErr instanceof Error ? bodyErr.message : String(bodyErr);
      console.error("Hubtel body read failed:", msg);
      return new Response(
        JSON.stringify({ error: `Payment response unreadable (HTTP ${hubtelRes.status})` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let hubtelData = {};
    try {
      hubtelData = JSON.parse(rawText);
    } catch {
      console.error("Hubtel non-JSON:", hubtelRes.status, rawText.slice(0, 300));
    }

    if (!hubtelRes.ok || String(hubtelData.status ?? "").toLowerCase() !== "success") {
      const errMsg = String(
        hubtelData.message ?? hubtelData.Message ?? hubtelData.error ??
        `Hubtel HTTP ${hubtelRes.status}: ${rawText.slice(0, 200)}`
      );
      console.error("Hubtel error:", hubtelRes.status, rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: errMsg }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const checkoutUrl = (hubtelData.data ?? {}).checkoutUrl;
    if (!checkoutUrl) {
      console.error("No checkoutUrl:", rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: "No checkout URL from Hubtel" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ checkoutUrl }),
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
