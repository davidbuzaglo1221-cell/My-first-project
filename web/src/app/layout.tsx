import type { Metadata, Viewport } from "next";
import "@fontsource-variable/heebo";
import "./globals.css";

export const metadata: Metadata = {
  title: "אימונים ותזונה",
  description: "תיעוד אימוני כוח, התקדמות ותזונה, בעברית",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B110E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
