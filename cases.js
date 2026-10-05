// cases.js — scenario data only. Every case here is SYNTHETIC; nothing in this file is a
// method. To use the tool for another trade, add a case here (or in a separate file that
// exports one) and leave navigator.js / landed.js / pack.js untouched. See docs/SWAP_GUIDE.md.

import { GULF_BASELINE as baseline } from "./cases/gulf-hospitality-baseline.js";

export const CASE_001 = {
  id: "TPN-001",
  label: "DEMO USD BASELINE / INSPIRED BY PUBLIC CLAIM / NOT VERIFIED",
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
  caseBaseline: { id: baseline.id, version: baseline.version },
  label: "DEMO CONNECTED CASE / DECISION DESK PLANNING BASIS / NOT COMMITTABLE",
  product: "Hospitality interior products (demo)",
  market: "UAE → Abu Dhabi hospitality projects (demo)",
  quantity: baseline.quantity,
  unit: "metres",
  unitZh: "公尺",
  unitContributionNote: "Planning price less known goods, trade, and project cost per metre of finished width. It does not resolve payment terms.",
  purchasePrice: baseline.costsPerUnitUsd.goods, // Owner-approved synthetic input, not a supplier quote
  sellingPrice: baseline.pricePerUnitUsd,
  currency: "USD",
  moq: baseline.quantity,
  paymentTerms: "UNRESOLVED: RFP says 90 days after delivery; referral note mentions 30% advance",
  paymentNote: "Context only · the payment contradiction is not used to rank a lever",
  evidence: "SYNTHETIC",
  knownCosts: { manufacturing: baseline.costsPerUnitUsd.goods, tradeAndProject: Math.round((baseline.costsPerUnitUsd.tradeLogistics + baseline.costsPerUnitUsd.dealSpecific + baseline.costsPerUnitUsd.contingency) * 100) / 100 },
  extraCostLabel: "Known trade + project cost",
  connectionNote: "Shared planning basis with the Commercial Decision Desk Gulf Coast Hospitality sample: 12,000 metres (one metre = one metre of finished width, excluding on-site installation) × USD 12 CIF, with USD 6.60 goods cost and USD 2.40 known trade/project/reserve cost per metre. The USD 6.60 goods cost is a demo assumption, not a supplier quote. The released volume and binding payment terms remain unresolved.",
  economicsBoundary: "KNOWN DECISION DESK PLANNING COSTS · RELEASED VOLUME AND BINDING PAYMENT TERMS REMAIN UNKNOWN",
  totalContributionNote: "Matches the decision desk planning expected net contribution before unresolved payment terms are accepted.",
  // Landed-economics basis. tradeCost, dealCost, contingency and the minimum come
  // from the canonical Owner-approved synthetic case (USD 12,600 / 10,800 / 5,400;
  // fixed minimum USD 28,800). Everything marked ASSUMPTION is illustrative and editable.
  landed: {
    tradeCost: baseline.costsPerUnitUsd.tradeLogistics,
    dealCost: baseline.costsPerUnitUsd.dealSpecific,
    contingency: baseline.costsPerUnitUsd.contingency,
    minimumContribution: baseline.minimumNetContributionUsd,
    dutyRate: 0.05, // ASSUMPTION: illustrative rate; verify for the actual HS code and destination
    dutyBearer: "BUYER", // Baseline buyer-borne duty; switching the bearer alone is not a full DDP quote
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
