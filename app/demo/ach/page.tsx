import type { Metadata } from "next";
import { BankDemo } from "@/components/bank-replay-viewer";

export const metadata: Metadata = {
  title: "Twisp Lens · Synthetic ACH replay",
  description: "Inspect what simulated bank agents knew, which actions were authorized, and what changed.",
};
export default function AchDemoPage() { return <BankDemo />; }
