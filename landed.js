// landed.js — landed economics, financing cost and sensitivity for one priced trade.
// Pure, deterministic, no I/O. Every figure that is not disclosed by the source
// case is an ASSUMPTION the decision-maker can edit; nothing here is a market rate.
//
// Question answered: "After freight, duty, payment timing and currency, how much
// is left, and which single assumption is the weakest link?"

const finite = (v) => typeof v === "number" && Number.isFinite(v);

import { DEFAULT_PACK, validatePack } from "./pack.js";

// How one standard shock changes the model, keyed by the shock id the pack lists. The
// SIZE of each shock (pack.shocks[].magnitude) is data and lives in the pack; only the
// mechanics live here.
const EFFECTS = {
  price: (m, k) => ({ priceMult: 1 - (m / 100) * k }),
  goods: (m, k) => ({ goodsMult: 1 + (m / 100) * k }),
  shipping: (m, k) => ({ tradeMult: 1 + (m / 100) * k }),
  fx: (m, k) => ({ fxMovePct: m * k }),
  delay: (m, k) => ({ delayDays: m * k }),
  rate: (m, k) => ({ rateAdd: (m / 100) * k }),
  duty: (m, k) => ({ dutyRateAdd: (m / 100) * k }),
};

export function buildShocks(pack = DEFAULT_PACK) {
  return pack.shocks.map((s) => ({ id: s.id, label: s.label, unit: s.unit, magnitude: s.magnitude, apply: (k) => EFFECTS[s.id](s.magnitude, k) }));
}

// Kept for callers that only need the default shocks.
export const SHOCKS = buildShocks(DEFAULT_PACK);

function validConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  const nums = [cfg.quantity, cfg.price, cfg.goodsCost, cfg.tradeCost, cfg.dealCost, cfg.contingency, cfg.dutyRate, cfg.costOfCapital];
  return nums.every(finite) && cfg.quantity > 0 && cfg.price >= 0 && cfg.goodsCost >= 0;
}

// Daily cash position per unit; funding is needed on every day the position is negative.
function financing(cfg, ov, termsKey) {
  const rate = cfg.costOfCapital + (ov.rateAdd ?? 0);
  const t = cfg.timeline;
  const goods = cfg.goodsCost * (ov.goodsMult ?? 1) * (1 + (cfg.fxShare ?? 0) * ((ov.fxMovePct ?? 0) / 100));
  const trade = cfg.tradeCost * (ov.tradeMult ?? 1);
  const events = [
    [t.depositDay, -goods * t.depositShare],
    [t.balanceDay, -goods * (1 - t.depositShare)],
    [t.otherCostDay, -(trade + cfg.dealCost)],
  ];
  const price = cfg.price * (ov.priceMult ?? 1);
  const dutyPerUnit = sellerDuty(cfg, ov, price);
  if (dutyPerUnit > 0) events.push([t.deliveryDay, -dutyPerUnit]);
  for (const r of cfg.terms[termsKey].receipts) {
    const day = r.base === "delivery" ? t.deliveryDay + r.offset : r.day;
    events.push([day + (r.late ? (ov.delayDays ?? 0) : 0), price * r.share]);
  }
  // Same-day inflows settle before outflows so a tie never shows a phantom funding gap.
  events.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  // Cash position is constant between events, so the funding cost is an exact
  // integral over each interval (correct for fractional days as well).
  let cash = 0;
  let peak = 0;
  let fundedDays = 0;
  let cost = 0;
  for (let i = 0; i < events.length; i++) {
    cash += events[i][1];
    const days = i + 1 < events.length ? events[i + 1][0] - events[i][0] : 0;
    if (cash < 0 && days > 0) {
      cost += (-cash * rate * days) / 365;
      fundedDays += days;
      peak = Math.max(peak, -cash);
    } else if (cash < 0) {
      peak = Math.max(peak, -cash);
    }
  }
  return { perUnit: cost, peakFundingPerUnit: peak, fundedDays };
}

function sellerDuty(cfg, ov, price) {
  if (cfg.dutyBearer !== "SELLER") return 0;
  return price * (cfg.dutyRate + (ov.dutyRateAdd ?? 0));
}

// Full landed picture for one scenario. Any invalid input makes it UNKNOWN.
export function calculateLanded(cfg, ov = {}) {
  if (!validConfig(cfg)) return { known: false };
  const termsKey = ov.terms ?? cfg.activeTerms;
  const price = cfg.price * (ov.priceMult ?? 1);
  const goods = cfg.goodsCost * (ov.goodsMult ?? 1) * (1 + (cfg.fxShare ?? 0) * ((ov.fxMovePct ?? 0) / 100));
  const trade = cfg.tradeCost * (ov.tradeMult ?? 1);
  const duty = sellerDuty(cfg, ov, price);
  const fin = financing(cfg, ov, termsKey);
  const q = cfg.quantity;
  const stack = [
    { id: "goods", label: "Goods cost", perUnit: goods, source: "CASE" },
    { id: "trade", label: "Freight, insurance and origin costs", perUnit: trade, source: "CASE" },
    { id: "deal", label: "Deal-specific cost", perUnit: cfg.dealCost, source: "CASE" },
    { id: "contingency", label: "Contingency reserve", perUnit: cfg.contingency, source: "CASE" },
    { id: "duty", label: "Import duty borne by seller", perUnit: duty, source: "ASSUMPTION" },
    { id: "financing", label: "Cost of funding the payment timeline", perUnit: fin.perUnit, source: "ASSUMPTION" },
  ];
  // Letter-of-credit bank fees are the decision-maker's input. Blank stays UNKNOWN and is never counted as zero cost.
  const lc = cfg.terms[termsKey].lc === true;
  const lcFeeUnknown = lc && !finite(cfg.lcFeePct);
  if (lc && !lcFeeUnknown) stack.push({ id: "lcFee", label: "Letter-of-credit bank fees", perUnit: price * cfg.lcFeePct, source: "YOUR INPUT" });
  for (const row of stack) row.total = row.perUnit * q;
  const costPerUnit = stack.reduce((sum, row) => sum + row.perUnit, 0);
  const netPerUnit = price - costPerUnit;
  const net = netPerUnit * q;
  const buyerDuty = cfg.dutyBearer === "BUYER" ? price * (cfg.dutyRate + (ov.dutyRateAdd ?? 0)) : 0;
  const min = finite(cfg.minimumContribution) ? cfg.minimumContribution : null;
  return {
    known: true,
    price,
    revenue: price * q,
    stack,
    costPerUnit,
    netPerUnit,
    net,
    marginPct: price > 0 ? (netPerUnit / price) * 100 : null,
    minimum: min,
    headroom: min === null ? null : net - min,
    belowMinimum: min === null ? null : net < min,
    financing: fin,
    lcFeeUnknown,
    buyerLandedPerUnit: price + buyerDuty,
    termsKey,
  };
}

// Net contribution change for each shock, ranked by damage, plus how far each
// driver can move before the decision-maker's minimum is breached (its cushion).
export function sensitivity(cfg, pack = DEFAULT_PACK) {
  const check = validatePack(pack);
  if (!check.ok) return { known: false, reason: "PACK_INVALID", problems: check.problems };
  const base = calculateLanded(cfg);
  if (!base.known) return { known: false };
  const rows = buildShocks(pack).map((shock) => {
    const shocked = calculateLanded(cfg, shock.apply(1));
    const buyerShift = ((shocked.buyerLandedPerUnit - base.buyerLandedPerUnit) / base.buyerLandedPerUnit) * 100;
    return {
      id: shock.id,
      label: shock.label,
      magnitude: `${shock.magnitude}${shock.unit}`,
      deltaNet: shocked.net - base.net,
      buyerLandedShiftPct: buyerShift,
      netAfter: shocked.net,
      breachesMinimum: base.minimum === null ? null : shocked.net < base.minimum,
      cushion: cushion(cfg, shock, base),
    };
  });
  rows.sort((a, b) => a.deltaNet - b.deltaNet || a.id.localeCompare(b.id));
  // Weakest link = the driver with the smallest cushion measured in standard
  // shocks (k < 1 means one standard shock already breaches the minimum). Raw
  // money impact cannot rank drivers measured in different units.
  const reachable = rows.filter((r) => r.cushion.reachable && !r.cushion.alreadyBreached);
  const weakest = reachable.length ? reachable.reduce((a, b) => (b.cushion.k < a.cushion.k ? b : a)) : null;
  return { known: true, base, rows, weakest };
}

// Smallest multiple k of the shock that brings net contribution down to the
// decision-maker's minimum, found by bisection (net is monotone in k for every driver).
function cushion(cfg, shock, base) {
  if (base.minimum === null) return { reachable: false, alreadyBreached: false };
  if (base.headroom < 0) return { reachable: false, alreadyBreached: true };
  const netAt = (k) => calculateLanded(cfg, shock.apply(k)).net;
  const limit = 40;
  if (netAt(limit) > base.minimum) return { reachable: false, alreadyBreached: false };
  let lo = 0;
  let hi = limit;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netAt(mid) > base.minimum) lo = mid;
    else hi = mid;
  }
  return { reachable: true, alreadyBreached: false, k: hi, magnitude: shock.magnitude * hi, unit: shock.unit };
}

// A letter of credit lowers collection risk, but the seller still advances the same cash while goods are
// paid for and shipped. True when the L/C ties up as much cash as the most cash-hungry term listed.
export function letterOfCreditCashNote(rows) {
  const lc = rows.find((r) => r.key === "D");
  if (!lc || !Number.isFinite(lc.peakFunding)) return { applies: false };
  const maxPeak = Math.max(...rows.map((r) => r.peakFunding));
  return { applies: maxPeak > 0 && lc.peakFunding >= maxPeak - 1e-6, peak: lc.peakFunding };
}

// The same trade under each payment-terms scenario the source case lists.
export function compareTerms(cfg) {
  if (!validConfig(cfg)) return { known: false };
  const rows = Object.entries(cfg.terms).map(([key, terms]) => {
    const result = calculateLanded(cfg, { terms: key });
    return { key, label: terms.label, lcFeeUnknown: result.lcFeeUnknown, financingTotal: result.financing.total ?? result.financing.perUnit * cfg.quantity, net: result.net, peakFunding: result.financing.peakFundingPerUnit * cfg.quantity };
  });
  const costs = rows.map((r) => r.financingTotal);
  return { known: true, rows, spread: Math.max(...costs) - Math.min(...costs) };
}
