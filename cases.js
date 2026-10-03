// cases.js — scenario data only. Every case here is SYNTHETIC; nothing in this file is a
// method. To use the tool for another trade, add a case here (or in a separate file that
// exports one) and leave navigator.js / landed.js / pack.js untouched. See docs/SWAP_GUIDE.md.

export const CASE_001 = {
  id: "TPN-001",
  label: "SYNTHETIC USD BASELINE / INSPIRED BY PUBLIC CLAIM / NOT VERIFIED",
  product: "Running shoe",
  market: "Southeast Asia → international retail",
  quantity: 1000,
  unit: "pairs",
  unitZh: "雙",
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
  unitZh: "公尺",
  unitContributionNote: "Planning price less known goods, trade, and project cost per metre of finished window width. It does not resolve payment terms.",
  purchasePrice: 22, // SYNTHETIC ASSUMPTION: USD 22 per metre of finished window width, not a supplier quote
  sellingPrice: 40,
  currency: "USD",
  moq: 12000,
  paymentTerms: "UNRESOLVED: RFP says 90 days after delivery; referral note mentions 30% advance",
  paymentNote: "Context only · the payment contradiction is not used to rank a lever",
  evidence: "SYNTHETIC",
  knownCosts: { manufacturing: 22, tradeAndProject: 8 },
  extraCostLabel: "Known trade + project cost",
  connectionNote: "Shared planning basis with the CDD Gulf Coast Hospitality sample: 12,000 metres (one metre = one metre of finished window width, excluding on-site installation) × USD 40, with USD 22 goods cost and USD 8 known trade/project cost per metre. The USD 22 goods cost is a synthetic assumption, not a supplier quote. The released volume and binding payment terms remain unresolved.",
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
