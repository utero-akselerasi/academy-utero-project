import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Utero Academy Platform",
  description: "Education Management System untuk Utero Academy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

