import { CASE_001, CASES } from "./cases.js";
export { CASE_001, CASE_GULF_001, CASES } from "./cases.js";

// Which case a page address asks for. An address with no case shows the default example. An address
// that names a case that does not exist still shows the default example, but says so
// (fellBack: true) so the page can tell the reader instead of silently showing something else.
export function resolveCase(search = "") {
  const requested = new URLSearchParams(search).get("case");
  if (requested === null || requested === "") return { case: CASE_001, requested: null, fellBack: false };
  const found = Object.hasOwn(CASES, requested) ? CASES[requested] : undefined;
  return found ? { case: found, requested, fellBack: false } : { case: CASE_001, requested, fellBack: true };
}

export function getCaseFromSearch(search = "") {
  return resolveCase(search).case;
}

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const positive = (value) => finite(value) && value > 0;

// Parse a form field. Blank, non-numeric or out-of-range input is UNKNOWN (null),
// never silently 0: a cleared price must not become a free or zero-price deal.
export function parseInput(raw, { allowZero = false } = {}) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  if (value < 0 || (value === 0 && !allowZero)) return null;
  return value;
}

function knownCostTotal(costs = {}) {
  const values = Object.values(costs);
  if (!values.length || !values.every(finite)) return null;
  return values.reduce((total, value) => total + value, 0);
}

export function calculateCase(input) {
  const knownUnitCost = knownCostTotal(input.knownCosts);
  const economicsKnown = finite(input.sellingPrice) && finite(knownUnitCost);
  const quantityKnown = positive(input.quantity);
  const moqKnown = positive(input.moq) && quantityKnown;
  const quantityBelowMOQ = moqKnown && input.quantity < input.moq;
  return {
    economicsKnown,
    moqKnown,
    quantityBelowMOQ,
    knownUnitCost,
    knownUnitContribution: economicsKnown ? input.sellingPrice - knownUnitCost : null,
    knownTotalContribution: economicsKnown && quantityKnown ? (input.sellingPrice - knownUnitCost) * input.quantity : null,
    economicsBoundary: economicsKnown ? (input.economicsBoundary ?? "KNOWN COSTS ONLY · TRADE COSTS REMAIN UNKNOWN") : "UNKNOWN",
  };
}

import { DEFAULT_PACK, assertPack } from "./pack.js";

// MOQ-tier lever scenario. The uplift and the discount come from the pack and are
// hypotheses, not supplier quotes.

// The saving only applies to units the business needs anyway; every unit bought
// beyond that need is inventory, so it is cash and risk, never "saving".
function moqTierScenario(input, levers) {
  const MOQ_TIER_UPLIFT = 1 + levers.moqTierUpliftPct / 100; // commit to a volume tier above the executable order
  const MOQ_TIER_DISCOUNT = levers.moqTierDiscountPct / 100; // unit price falls at that tier
  if (!positive(input.quantity) || !finite(input.purchasePrice)) return null;
  const need = input.quantity;
  const executableQty = positive(input.moq) ? Math.max(input.moq, need) : need;
  const topUpUnits = executableQty - need;
  const tierQty = Math.ceil(executableQty * MOQ_TIER_UPLIFT);
  const commit = input.purchasePrice * (1 - MOQ_TIER_DISCOUNT) * tierQty;
  return {
    need,
    executableQty,
    tierQty,
    inventoryUnits: tierQty - need,
    savingOnNeededUnits: input.purchasePrice * MOQ_TIER_DISCOUNT * need,
    commit,
    incrementalCash: commit - input.purchasePrice * executableQty,
    topUpCash: input.purchasePrice * topUpUnits,
  };
}

export function calculateLevers(input, lang = "en", pack = DEFAULT_PACK) {
  assertPack(pack);
  const levers = pack.levers;
  const base = calculateCase(input);
  const supplierSaving = finite(input.purchasePrice) ? input.purchasePrice * (levers.supplierCostCutPct / 100) : null;
  const tier = moqTierScenario(input, levers);
  if (lang === "zh") return calculateLeversZh(input, base, supplierSaving, tier, levers);
  const unit = input.unit ?? "units";
  const units = (n) => `${n.toLocaleString("en-US")} ${unit}`;
  const evidence = input.evidence === "SYNTHETIC"
    ? "DEMO · decision desk planning basis, not binding terms"
    : "PUBLIC_CLAIM · purchase price is not verified";
  return [
    {
      id: "cost",
      title: `Test a ${levers.supplierCostCutPct}% supplier cost reduction`,
      direction: supplierSaving === null || !positive(input.quantity) ? "UPSIDE = UNKNOWN" : `+${formatMoney(supplierSaving * input.quantity, input.currency)} known contribution before trade costs`,
      cash: "No new inventory requirement if volume stays unchanged",
      risk: "Supplier quality, lead time or certification may change",
      evidence,
      unknown: "Whether a supplier can reduce cost without changing specification",
      next: "Request a like-for-like cost breakdown and quality confirmation",
      owner: "Approve a controlled supplier negotiation, not a blanket cost cut",
      sort: 1,
    },
    {
      id: "moq",
      title: "Test higher MOQ economics",
      direction: tier === null
        ? "UPSIDE = UNKNOWN"
        : `Saves ${formatMoney(tier.savingOnNeededUnits, input.currency)} on the ${units(tier.need)} you need, only if the tier price is real`,
      cash: tier === null
        ? "UNKNOWN"
        : `Commits ${formatMoney(tier.commit, input.currency)} for ${units(tier.tierQty)} (${tier.incrementalCash >= 0 ? "+" : "-"}${formatMoney(Math.abs(tier.incrementalCash), input.currency)} vs ordering ${units(tier.executableQty)}); ${units(tier.inventoryUnits)} become inventory${tier.topUpCash > 0 ? `. MOQ top-up: ${formatMoney(tier.topUpCash, input.currency)} to reach the minimum order` : ""}`,
      risk: "Demand, inventory holding and obsolescence remain UNKNOWN",
      evidence: `HYPOTHESIS · a +${levers.moqTierUpliftPct}% volume tier at ${levers.moqTierDiscountPct}% lower unit price are scenario assumptions, not quotes`,
      unknown: tier === null ? "UNKNOWN · quantity and purchase price are required" : `Whether demand absorbs the extra ${units(tier.inventoryUnits)}`,
      next: "Obtain a rolling forecast or buyer commitment before increasing MOQ",
      owner: "Decide whether the cash exposure is acceptable for the test order",
      sort: 2,
    },
    {
      id: "odm",
      title: "Explore OEM → ODM / supply solution",
      direction: "UPSIDE = UNKNOWN · no selling-price increase is assumed",
      cash: "Design, packaging, certification and coordination costs are UNKNOWN",
      risk: "Execution scope expands before commercial demand is proven",
      evidence: "HYPOTHESIS · product, QC and delivery coordination may add value",
      unknown: "UNKNOWN · Buyer willingness to pay and required capability scope",
      next: "Ask one target buyer which coordination problem they would pay to remove",
      owner: "Choose whether to test a narrow service bundle or stay product-only",
      sort: 3,
    },
  ].map((lever) => ({ ...lever, evidenceState: lever.evidence.split(" · ")[0], baseContribution: base.knownTotalContribution }));
}

export function formatMoney(value, currency = "USD") {
  if (!finite(value)) return "UNKNOWN";
  return `${currency} ${Math.round(value).toLocaleString("en-US")}`;
}

// Traditional Chinese wording for the three levers. Same numbers, same structure; only the words differ.
// The Chinese unit word is case data (unitZh); a case without one gets the generic word.

function calculateLeversZh(input, base, supplierSaving, tier, levers) {
  const unit = input.unitZh ?? "單位";
  const units = (n) => `${n.toLocaleString("en-US")} ${unit}`;
  const evidence = input.evidence === "SYNTHETIC"
    ? "示範 · 商務決策工作台規劃基準，不是具約束力的條件"
    : "PUBLIC_CLAIM · 採購價未經驗證";
  return [
    {
      id: "cost",
      title: `試試把供應商成本降低 ${levers.supplierCostCutPct}%`,
      direction: supplierSaving === null || !positive(input.quantity) ? "上行空間 = UNKNOWN" : `+${formatMoney(supplierSaving * input.quantity, input.currency)} 已知貢獻（還沒扣貿易成本）`,
      cash: "數量不變的話，不需要新增庫存",
      risk: "供應商的品質、交期或認證可能改變",
      evidence,
      unknown: "供應商能不能在不改規格的情況下降低成本",
      next: "要求一份同規格的成本拆解與品質確認",
      owner: "核准一次可控的供應商議價，而不是一刀切的降價",
      sort: 1,
    },
    {
      id: "moq",
      title: "試算更高 MOQ 的經濟效益",
      direction: tier === null
        ? "上行空間 = UNKNOWN"
        : `只有在階梯價是真的前提下，你需要的 ${units(tier.need)} 能省 ${formatMoney(tier.savingOnNeededUnits, input.currency)}`,
      cash: tier === null
        ? "UNKNOWN"
        : `為 ${units(tier.tierQty)} 承諾 ${formatMoney(tier.commit, input.currency)}（相較下單 ${units(tier.executableQty)}，${tier.incrementalCash >= 0 ? "+" : "-"}${formatMoney(Math.abs(tier.incrementalCash), input.currency)}）；其中 ${units(tier.inventoryUnits)} 會變成庫存${tier.topUpCash > 0 ? `。MOQ 補足：為了湊到最低訂購量，需要 ${formatMoney(tier.topUpCash, input.currency)}` : ""}`,
      risk: "需求、庫存持有與過時的風險仍是 UNKNOWN",
      evidence: `HYPOTHESIS · 數量階梯 +${levers.moqTierUpliftPct}%、單價低 ${levers.moqTierDiscountPct}%，只是情境假設，不是報價`,
      unknown: tier === null ? "UNKNOWN · 需要先有數量與採購價" : `需求能不能消化多出來的 ${units(tier.inventoryUnits)}`,
      next: "提高 MOQ 之前，先取得滾動預測或買方承諾",
      owner: "決定這筆試單的現金曝險能不能接受",
      sort: 2,
    },
    {
      id: "odm",
      title: "探索 OEM → ODM / 供應方案",
      direction: "上行空間 = UNKNOWN · 沒有假設任何售價上漲",
      cash: "設計、包裝、認證與協調成本都是 UNKNOWN",
      risk: "在商業需求被證實之前，執行範圍就先擴大了",
      evidence: "HYPOTHESIS · 產品、品管與交貨協調可能創造價值",
      unknown: "UNKNOWN · 買方願不願意付錢、需要的能力範圍",
      next: "問一位目標買方：哪一個協調問題，他願意付錢解決",
      owner: "選擇要試一個窄的服務組合，還是維持只賣產品",
      sort: 3,
    },
  ].map((lever) => ({ ...lever, evidenceState: lever.evidence.split(" · ")[0], baseContribution: base.knownTotalContribution }));
}
