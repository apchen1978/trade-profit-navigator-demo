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

const finite = (value) => typeof value === "number" && Number.isFinite(value);

export function calculateCase(input) {
  const knownUnitCost = input.knownCosts?.manufacturing;
  const economicsKnown = finite(input.sellingPrice) && finite(knownUnitCost);
  const moqKnown = finite(input.moq) && finite(input.quantity);
  const quantityBelowMOQ = moqKnown && input.quantity < input.moq;
  return {
    economicsKnown,
    moqKnown,
    quantityBelowMOQ,
    knownUnitContribution: economicsKnown ? input.sellingPrice - knownUnitCost : null,
    knownTotalContribution: economicsKnown ? (input.sellingPrice - knownUnitCost) * input.quantity : null,
    economicsBoundary: economicsKnown ? "KNOWN COSTS ONLY · TRADE COSTS REMAIN UNKNOWN" : "UNKNOWN",
  };
}

export function calculateLevers(input) {
  const base = calculateCase(input);
  const supplierSaving = finite(input.purchasePrice) ? input.purchasePrice * 0.05 : null;
  const moqBasis = finite(input.moq) ? Math.max(input.moq, input.quantity) : input.quantity;
  const moqUnitSaving = finite(input.purchasePrice) ? input.purchasePrice * 0.08 : null;
  return [
    {
      id: "cost",
      title: "Test a 5% supplier cost reduction",
      direction: supplierSaving === null ? "UPSIDE = UNKNOWN" : `+${formatMoney(supplierSaving * input.quantity, input.currency)} known contribution before trade costs`,
      cash: "No new inventory requirement if volume stays unchanged",
      risk: "Supplier quality, lead time or certification may change",
      evidence: "PUBLIC_CLAIM · purchase price is not verified",
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
      unknown: `Whether demand supports ${moqBasis.toLocaleString()} pairs`,
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
