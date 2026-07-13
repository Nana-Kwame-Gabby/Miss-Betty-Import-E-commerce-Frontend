// @ts-nocheck
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeGhanaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return "233" + digits.slice(1);
  return "233" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const { message, phones } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or empty message" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(phones) || phones.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients provided" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "SMS service not configured — missing ARKESEL_API_KEY" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const recipients = phones
      .filter((p) => typeof p === "string" && p.trim())
      .map((p) => normalizeGhanaPhone(p.trim()));

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid phone numbers after normalization" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Arkesel v1 API — comma-separated recipients
    const url = new URL("https://sms.arkesel.com/sms/api");
    url.searchParams.set("action", "send-sms");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("to", recipients.join(","));
    url.searchParams.set("from", "MissBetty");
    url.searchParams.set("sms", message.trim());

    const smsRes = await fetch(url.toString(), { method: "GET" });

    const rawText = await smsRes.text().catch(() => "");
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { /**/ }

    // Arkesel v1 returns { status: "success", ... } on success
    const status = String(data.status ?? "").toLowerCase();
    if (!smsRes.ok || (status && status !== "success")) {
      console.error("Arkesel error:", smsRes.status, rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: data.message ?? data.status ?? `Arkesel HTTP ${smsRes.status}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length, data }),
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
