import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostPulse",
  description: "Find out why your posts flop, and what to post next week.",
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
