import Solo401k from "../../../tools/solo-401k/Solo401k";

export const metadata = {
  title: "Solo 401(k) Calculator — Marginal",
  description: "Self-employment retirement contribution limits, SE tax math, employee + employer contribution optimizer, and Solo 401k vs SEP-IRA comparison.",
};

export default function Page() {
  return <Solo401k />;
}
