import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CardWise | Use the right card, every time",
  description: "Evidence-backed credit card recommendations for every purchase.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
