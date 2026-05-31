import RothConversion from "../../../tools/roth-conversion/RothConversion";

export const metadata = {
  title: "Roth Conversion Optimizer — Marginal",
  description: "Fill tax brackets during low-income years with Roth conversions. Model conversion amount, tax cost, future value, IRMAA impact.",
};

export default function Page() {
  return <RothConversion />;
}
