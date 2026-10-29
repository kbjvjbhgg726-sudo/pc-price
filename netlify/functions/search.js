const HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

async function getJson(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function reply(code, body, extra) {
  return {
    statusCode: code,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extra || {}),
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const q = (params.q || "").trim().slice(0, 80);
  const page = Math.min(Math.max(parseInt(params.page, 10) || 1, 1), 5);
  if (!q) return reply(400, { error: "empty_query" });

  const qs = new URLSearchParams({ q, page, has_selling_stock: 1 }).toString();
  let data;
  try {
    data = await getJson("https://api.digikala.com/v3/search/?" + qs);
  } catch (e) {
    try {
      data = await getJson("https://api.digikala.com/v1/search/?" + qs);
    } catch (e2) {
      return reply(502, { error: "digikala_unreachable", detail: String(e2.message) });
    }
  }

  const products = ((data.data || {}).products || [])
    .map((p) => {
      const price = ((p.default_variant || {}).price) || {};
      const sell = price.selling_price || 0;
      if (!sell) return null;
      const rrp = price.rrp_price || 0;
      const img = ((((p.images || {}).main || {}).url) || [])[0] || "";
      return {
        id: p.id,
        title: p.title_fa || p.title_en || "",
        price: Math.floor(sell / 10),
        oldPrice: rrp > sell ? Math.floor(rrp / 10) : 0,
        image: img,
        url: "https://www.digikala.com/product/dkp-" + p.id + "/",
      };
    })
    .filter(Boolean);

  return reply(200, { products }, { "Cache-Control": "public, max-age=0, s-maxage=300" });
};
