import CompensationOptimizer from "../../../tools/compensation-optimizer/CompensationOptimizer";

export const metadata = {
  title: "Compensation Optimizer — Marginal",
  description: "Maximize take-home utility across 401k, HSA, FSA, IRA, and mega-backdoor Roth. Coordinate-descent solver with full state tax support.",
};

export default function Page() {
  return <CompensationOptimizer />;
}
