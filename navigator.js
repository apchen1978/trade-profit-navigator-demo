export const CASE_001 = {
  id: "TPN-001",
  label: "SYNTHETIC USD BASELINE / INSPIRED BY PUBLIC CLAIM / NOT VERIFIED",
  product: "Running shoe",
  market: "Southeast Asia → international retail",
  quantity: 1000,
  unit: "pairs",
  purchasePrice: 18,
  sellingPrice: 110,
  currency: "USD",
  moq: 1000,
  paymentTerms: "30% deposit / balance before shipment",
  evidence: "PUBLIC_CLAIM",
  valuePool: true,
  sellingLabel: "Retail price (reference)",
  valuePoolNote: "Retail reference price less manufacturing cost: the value pool between factory and shelf. It is not what a factory or trader earns; freight, duty, importer and retailer margin all sit inside it.",
  knownCosts: { manufacturing: 18 },
  unknowns: ["Freight, import duties and warehousing", "Returns and after-sales cost", "Whether the channel price is achievable"]
};

// Reuses only the disclosed planning basis of CDD's Gulf Coast Hospitality
// fixture. It is not a live integration, shared session, or order approval.
export const CASE_GULF_001 = {
  id: "GULF-001",
  label: "SYNTHETIC CONNECTED CASE / CDD PLANNING BASIS / NOT COMMITTABLE",
  product: "Blackout drapery, sheer curtains and decorative valances",
  market: "UAE → Abu Dhabi hospitality projects (synthetic)",
  quantity: 12000,
  unit: "metres",
  purchasePrice: 22,
  sellingPrice: 40,
  currency: "USD",
  moq: 12000,
  paymentTerms: "UNRESOLVED: RFP says 90 days after delivery; referral note mentions 30% advance",
  paymentNote: "Context only · the payment contradiction is not used to rank a lever",
  evidence: "SYNTHETIC",
  knownCosts: { manufacturing: 22, tradeAndProject: 8 },
  extraCostLabel: "Known trade + project cost",
  connectionNote: "Shared planning basis with the CDD Gulf Coast Hospitality sample: 12,000 metres × USD 40, with USD 22 goods cost and USD 8 known trade/project cost per metre. The released volume and binding payment terms remain unresolved.",
  economicsBoundary: "KNOWN CDD PLANNING COSTS · RELEASED VOLUME AND BINDING PAYMENT TERMS REMAIN UNKNOWN",
  totalContributionNote: "Matches the CDD planning expected net contribution before unresolved payment terms are accepted.",
  // Landed-economics basis. tradeCost, dealCost, contingency and the minimum come
  // from CDD's planning economics (USD 42,000 / 36,000 / 18,000 over 12,000 m; owner
  // minimum USD 96,000). Everything marked ASSUMPTION is illustrative and editable.
  landed: {
    tradeCost: 3.5,
    dealCost: 3.0,
    contingency: 1.5,
    minimumContribution: 96000,
    dutyRate: 0.05, // ASSUMPTION: illustrative rate; verify for the actual HS code and destination
    dutyBearer: "BUYER", // CIF quote: import duty is the buyer's unless the seller quotes DDP
    costOfCapital: 0.08, // ASSUMPTION: annual cost of funding working capital
    fxShare: 1, // ASSUMPTION: goods cost is paid in a currency other than the quote currency
    timeline: { depositShare: 0.3, depositDay: 0, balanceDay: 45, otherCostDay: 60, deliveryDay: 75 }, // ASSUMPTION: schedule
    terms: {
      A: { label: "RFP: payment 90 days after delivery", receipts: [{ share: 1, base: "delivery", offset: 90, late: true }] },
      B: { label: "Referral note: 30% advance; timing of the 70% is UNKNOWN (assumed before shipment)", receipts: [{ share: 0.3, day: 0 }, { share: 0.7, day: 60, late: true }] },
      // First-order options a seller could propose. Schedules are ASSUMPTIONS the owner can compare, not terms any buyer has agreed.
      C: { label: "Staged: 30% at order, 40% before shipment, 30% 30 days after delivery", receipts: [{ share: 0.3, day: 0 }, { share: 0.4, day: 60 }, { share: 0.3, base: "delivery", offset: 30, late: true }] },
      D: { label: "Letter of credit at sight: paid when shipping documents are accepted", lc: true, receipts: [{ share: 1, day: 62, late: true }] },
      E: { label: "Full prepayment before production", receipts: [{ share: 1, day: 0 }] },
    },
    activeTerms: "A",
  },
  unknowns: ["Released purchase-order quantity and phased schedule", "Binding 30% / 70% payment triggers", "Final commercial approver and scope acceptance"]
};

export const CASES = {
  "case-001": CASE_001,
  "gulf-001": CASE_GULF_001,
};

export function getCaseFromSearch(search = "") {
  const caseId = new URLSearchParams(search).get("case");
  return CASES[caseId] ?? CASE_001;
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

// MOQ-tier lever scenario. Both numbers are hypotheses, not supplier quotes.
const MOQ_TIER_UPLIFT = 1.5; // commit to a volume tier 50% above the executable order
const MOQ_TIER_DISCOUNT = 0.08; // unit price falls 8% at that tier

// The saving only applies to units the business needs anyway; every unit bought
// beyond that need is inventory, so it is cash and risk, never "saving".
function moqTierScenario(input) {
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

export function calculateLevers(input, lang = "en") {
  const base = calculateCase(input);
  const supplierSaving = finite(input.purchasePrice) ? input.purchasePrice * 0.05 : null;
  const tier = moqTierScenario(input);
  if (lang === "zh") return calculateLeversZh(input, base, supplierSaving, tier);
  const unit = input.unit ?? "units";
  const units = (n) => `${n.toLocaleString("en-US")} ${unit}`;
  const evidence = input.evidence === "SYNTHETIC"
    ? "SYNTHETIC · CDD planning basis, not binding terms"
    : "PUBLIC_CLAIM · purchase price is not verified";
  return [
    {
      id: "cost",
      title: "Test a 5% supplier cost reduction",
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
      evidence: "HYPOTHESIS · a +50% volume tier at 8% lower unit price are scenario assumptions, not quotes",
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
const ZH_UNITS = { pairs: "雙", metres: "公尺", units: "單位" };

function calculateLeversZh(input, base, supplierSaving, tier) {
  const unit = ZH_UNITS[input.unit ?? "units"] ?? "單位";
  const units = (n) => `${n.toLocaleString("en-US")} ${unit}`;
  const evidence = input.evidence === "SYNTHETIC"
    ? "SYNTHETIC · CDD 規劃基準，不是具約束力的條件"
    : "PUBLIC_CLAIM · 採購價未經驗證";
  return [
    {
      id: "cost",
      title: "試試把供應商成本降低 5%",
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
      evidence: "HYPOTHESIS · 數量階梯 +50%、單價低 8%，只是情境假設，不是報價",
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
