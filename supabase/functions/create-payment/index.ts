// create-payment — Edge Function
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const currency = String(body.currency || "").toLowerCase();
    const isDirectPurchase = Boolean(body.direct_purchase);
    const productId = body.product_id ? String(body.product_id) : null;
    const qty = body.qty ? Number(body.qty) : 1;

    const validCurrencies = ["usdttrc20", "usdterc20", "btc", "eth", "ltc"];
    if (!amount || amount < 1 || amount > 5000) {
      return new Response(JSON.stringify({ error: "Amount must be between 1 and 5000" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!validCurrencies.includes(currency)) {
      return new Response(JSON.stringify({ error: "Invalid currency" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "NOWPAYMENTS_API_KEY secret is not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txInsert: Record<string, unknown> = {
      user_id: user.id,
      amount,
      currency,
      status: "pending",
      purchase_type: isDirectPurchase ? "direct" : "topup",
    };

    if (isDirectPurchase && productId) {
      txInsert.product_id = productId;
      txInsert.qty = qty;
    }

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert(txInsert)
      .select()
      .single();

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: txError?.message || "Failed to create transaction" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ipnUrl = `${supabaseUrl}/functions/v1/nowpayments-ipn`;

    const npRes = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency: currency,
        order_id: tx.id,
        ipn_callback_url: ipnUrl,
      }),
    });

    const npData = await npRes.json();

    if (!npRes.ok) {
      await supabase.from("transactions").update({ status: "failed" }).eq("id", tx.id);
      return new Response(JSON.stringify({ error: npData.message || "NOWPayments error" }), {
        status: npRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("transactions").update({
      np_payment_id: String(npData.payment_id),
      pay_address: npData.pay_address,
      pay_amount: Number(npData.pay_amount),
    }).eq("id", tx.id);

    return new Response(JSON.stringify({
      transaction_id: tx.id,
      payment_id: npData.payment_id,
      pay_address: npData.pay_address,
      pay_amount: npData.pay_amount,
      pay_currency: currency,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
