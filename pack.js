// pack.js — the assumptions a scenario brings with it, kept out of the method.
//
// A pack holds numbers the decision-maker CHOSE (how large a "standard shock" is, which
// scenario levers to test). It never holds rules: how the model works lives in
// landed.js and navigator.js and does not change when a pack is swapped. Every
// figure here is illustrative and editable; none is a market rate or a quote.
//
// Fail-closed: a pack that is incomplete or malformed is refused (validatePack /
// assertPack) instead of being filled in. Nothing is defaulted silently.

const finite = (v) => typeof v === "number" && Number.isFinite(v);

// The seven drivers landed.js knows how to shock. A pack must size every one of them;
// leaving one out would silently drop a driver from the sensitivity ranking.
export const REQUIRED_SHOCK_IDS = ["price", "goods", "shipping", "fx", "delay", "rate", "duty"];

export const DEFAULT_PACK = {
  id: "tpn-default-assumptions",
  version: "0.1.0",
  status: "ILLUSTRATIVE",
  effectiveDate: "2026-10-03",
  source: "Standard shocks chosen by the decision-maker, carried over unchanged from landed.js v0.4. Illustrative, not market data.",
  shocks: [
    { id: "price", label: "Selling price falls by", unit: "%", magnitude: 5 },
    { id: "goods", label: "Goods cost rises by", unit: "%", magnitude: 5 },
    { id: "shipping", label: "Freight and logistics rise by", unit: "%", magnitude: 30 },
    { id: "fx", label: "Cost currency strengthens against the quote currency by", unit: "%", magnitude: 3 },
    { id: "delay", label: "Buyer pays later than agreed by", unit: " days", magnitude: 30 },
    { id: "rate", label: "Cost of capital rises by", unit: " pts", magnitude: 3 },
    { id: "duty", label: "Import duty rate rises by", unit: " pts", magnitude: 10 },
  ],
  levers: {
    supplierCostCutPct: 5, // lever 1: "test a 5% supplier cost reduction"
    moqTierUpliftPct: 50, // lever 2: commit to a volume tier 50% above the executable order
    moqTierDiscountPct: 8, // lever 2: unit price falls 8% at that tier
  },
};

export function validatePack(pack) {
  const problems = [];
  if (!pack || typeof pack !== "object") return { ok: false, problems: ["PACK_MISSING"] };
  for (const key of ["id", "version", "status", "effectiveDate", "source"]) {
    if (typeof pack[key] !== "string" || pack[key].trim() === "") problems.push(`METADATA_MISSING:${key}`);
  }
  const shocks = Array.isArray(pack.shocks) ? pack.shocks : [];
  if (!shocks.length) problems.push("SHOCKS_MISSING");
  const seen = new Set();
  for (const s of shocks) {
    if (!s || typeof s.id !== "string") { problems.push("SHOCK_WITHOUT_ID"); continue; }
    if (!REQUIRED_SHOCK_IDS.includes(s.id)) problems.push(`SHOCK_UNKNOWN_ID:${s.id}`);
    if (seen.has(s.id)) problems.push(`SHOCK_DUPLICATE:${s.id}`);
    seen.add(s.id);
    if (!finite(s.magnitude) || s.magnitude <= 0) problems.push(`SHOCK_MAGNITUDE_INVALID:${s.id}`);
    if (typeof s.label !== "string" || typeof s.unit !== "string") problems.push(`SHOCK_LABEL_OR_UNIT_MISSING:${s.id}`);
  }
  for (const id of REQUIRED_SHOCK_IDS) if (!seen.has(id)) problems.push(`SHOCK_MISSING:${id}`);
  const lv = pack.levers ?? {};
  const pct = (v) => finite(v) && v > 0 && v < 100;
  if (!pct(lv.supplierCostCutPct)) problems.push("LEVER_INVALID:supplierCostCutPct");
  if (!pct(lv.moqTierDiscountPct)) problems.push("LEVER_INVALID:moqTierDiscountPct");
  if (!finite(lv.moqTierUpliftPct) || lv.moqTierUpliftPct <= 0) problems.push("LEVER_INVALID:moqTierUpliftPct");
  return { ok: problems.length === 0, problems };
}

export function assertPack(pack) {
  const check = validatePack(pack);
  if (!check.ok) throw new Error(`PACK_INVALID: ${check.problems.join(", ")}`);
  return pack;
}
