import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WealthKit — Financial Tools for High Earners",
  description:
    "Open-source, client-side financial planning tools. Transparent math, zero data retention.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
