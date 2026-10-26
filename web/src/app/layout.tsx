import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-400.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-500.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-600.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-400.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-500.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-600.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-700.css";
import "@fontsource/ibm-plex-sans-hebrew/latin-700.css";
import "./globals.css";
import { Providers } from "@/components/app/providers";

export const metadata: Metadata = {
  title: "אימונים ותזונה",
  description: "תיעוד אימוני כוח, התקדמות ותזונה, בעברית",
  appleWebApp: { capable: true, title: "אימונים", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png", icon: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F4F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0E100F" },
  ],
};

// Light is the default look; dark is an opt-in in settings (data-theme="dark").
// The saved choice is applied before first paint, so a dark-theme user never sees a light flash.
const THEME_BOOT = `try{var t=localStorage.getItem("theme");var r=document.documentElement;if(t==="dark"||t==="light")r.dataset.theme=t;else if(t==="system")r.removeAttribute("data-theme")}catch(e){}`;
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
