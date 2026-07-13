// @ts-nocheck
// One-shot function: creates the promo_alert row in app_settings if it doesn't exist.
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
// Safe to call multiple times (idempotent).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
  }

  const headers = {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
  };

  // Check if the row already exists
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/app_settings?setting_key=eq.promo_alert&select=setting_key`,
    { headers }
  );
  const existing = await checkRes.json();

  if (Array.isArray(existing) && existing.length > 0) {
    return new Response(JSON.stringify({ message: "promo_alert row already exists — nothing to do." }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Insert the row
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/app_settings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      setting_key: "promo_alert",
      setting_value_bool: false,
      setting_value_text: null,
    }),
  });

  if (insertRes.ok) {
    return new Response(JSON.stringify({ message: "promo_alert row created successfully." }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const errText = await insertRes.text();
  return new Response(JSON.stringify({ error: errText }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
});
