import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude Code Replay Viewer",
  description: "Rerun a Claude Code session as an interactive timeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
