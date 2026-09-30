// nowpayments-ipn — Edge Function (self-contained, no JWT, paste into dashboard)
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifySignature(body: string, sig: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(body);

  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, msgData);
  const hex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === sig;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const sig = req.headers.get("x-nowpayments-sig") || "";
    const secret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");

    if (!secret) {
      return new Response(JSON.stringify({ error: "IPN secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = await verifySignature(rawBody, sig, secret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ipn = JSON.parse(rawBody);
    const orderId = ipn.order_id;
    const status = String(ipn.payment_status || "").toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", orderId)
      .single();

    if (txErr || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === "finished" && !tx.credited) {
      const { error: rpcErr } = await supabase.rpc("credit_balance", { tx_id: tx.id });
      if (rpcErr) {
        return new Response(JSON.stringify({ error: rpcErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (status === "partially_paid") {
      await supabase.from("transactions").update({ status: "partially_paid" }).eq("id", tx.id);
    } else if (status === "expired" || status === "failed") {
      await supabase.from("transactions").update({ status }).eq("id", tx.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
