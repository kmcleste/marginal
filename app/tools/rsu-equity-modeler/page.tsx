import RsuEquityModeler from "../../../tools/rsu-equity-modeler/RsuEquityModeler";

export const metadata = {
  title: "RSU / Equity Modeler — Marginal",
  description: "Model RSU and NSO vesting schedules, tax at vest, sell-to-cover vs hold, and concentration risk.",
};

export default function Page() {
  return <RsuEquityModeler />;
}
