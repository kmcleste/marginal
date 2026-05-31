import CapGainsHarvester from "../../../tools/cap-gains-harvester/CapGainsHarvester";

export const metadata = {
  title: "Capital Gains Bracket Harvester — Marginal",
  description: "Harvest long-term capital gains at 0% in the 15% bracket, with income stacking visualization, basis step-up strategies, and multi-year harvest planning.",
};

export default function Page() {
  return <CapGainsHarvester />;
}
