import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-400.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-500.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-600.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-400.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-500.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-600.css";
import "@fontsource-variable/frank-ruhl-libre";
import "./globals.css";

export const metadata: Metadata = {
  title: "אימונים ותזונה",
  description: "תיעוד אימוני כוח, התקדמות ותזונה, בעברית",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#061A15",
};

// Dark glass is the default look; light is an opt-in in settings (data-theme="light").
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
