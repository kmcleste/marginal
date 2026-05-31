import TaxLossHarvester from "../../../tools/tax-loss-harvester/TaxLossHarvester";

export const metadata = {
  title: "Tax-Loss Harvester — Marginal",
  description: "Wash-sale-aware tax-loss harvesting: select losing positions, quantify tax savings, get replacement ETF suggestions, and compute the NPV of tax deferral.",
};

export default function Page() {
  return <TaxLossHarvester />;
}
