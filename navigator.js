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

function knownCostTotal(costs = {}) {
  const values = Object.values(costs).filter(finite);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

export function calculateCase(input) {
  const knownUnitCost = knownCostTotal(input.knownCosts);
  const economicsKnown = finite(input.sellingPrice) && finite(knownUnitCost);
  const moqKnown = finite(input.moq) && finite(input.quantity);
  const quantityBelowMOQ = moqKnown && input.quantity < input.moq;
  return {
    economicsKnown,
    moqKnown,
    quantityBelowMOQ,
    knownUnitCost,
    knownUnitContribution: economicsKnown ? input.sellingPrice - knownUnitCost : null,
    knownTotalContribution: economicsKnown ? (input.sellingPrice - knownUnitCost) * input.quantity : null,
    economicsBoundary: economicsKnown ? (input.economicsBoundary ?? "KNOWN COSTS ONLY · TRADE COSTS REMAIN UNKNOWN") : "UNKNOWN",
  };
}

export function calculateLevers(input) {
  const base = calculateCase(input);
  const supplierSaving = finite(input.purchasePrice) ? input.purchasePrice * 0.05 : null;
  const moqBasis = finite(input.moq) ? Math.max(input.moq, input.quantity) : input.quantity;
  const moqUnitSaving = finite(input.purchasePrice) ? input.purchasePrice * 0.08 : null;
  const unit = input.unit ?? "units";
  const evidence = input.evidence === "SYNTHETIC"
    ? "SYNTHETIC · CDD planning basis, not binding terms"
    : "PUBLIC_CLAIM · purchase price is not verified";
  return [
    {
      id: "cost",
      title: "Test a 5% supplier cost reduction",
      direction: supplierSaving === null ? "UPSIDE = UNKNOWN" : `+${formatMoney(supplierSaving * input.quantity, input.currency)} known contribution before trade costs`,
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
      direction: moqUnitSaving === null ? "UPSIDE = UNKNOWN" : `Potential saving: ${formatMoney(moqUnitSaving * moqBasis, input.currency)} before inventory cost`,
      cash: `Additional purchase exposure: ${formatMoney(input.purchasePrice * (moqBasis - input.quantity), input.currency)}`,
      risk: "Demand, inventory holding and obsolescence remain UNKNOWN",
      evidence: "HYPOTHESIS · 8% saving is a scenario assumption",
      unknown: `Whether demand supports ${moqBasis.toLocaleString()} ${unit}`,
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
