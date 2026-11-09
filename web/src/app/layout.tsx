import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-400.css";
import "@fontsource/frank-ruhl-libre/hebrew-500.css";
import "@fontsource/frank-ruhl-libre/hebrew-700.css";
import "@fontsource/frank-ruhl-libre/latin-500.css";
import "@fontsource/frank-ruhl-libre/latin-700.css";
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
  title: "דוד 2.0",
  description: "מסע של 90 יום: משמעת, גוף, כריזמה, מכירות ועסק",
  appleWebApp: { capable: true, title: "דוד 2.0", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png", icon: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F1EA" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
  ],
};

// Dark is the default look; light is an opt-in in settings (data-theme="light").
// The saved choice is applied before first paint, so a light-theme user never sees a dark flash.
const THEME_BOOT = `try{var t=localStorage.getItem("theme");var r=document.documentElement;if(t==="dark"||t==="light")r.dataset.theme=t;else if(t==="system")r.removeAttribute("data-theme")}catch(e){}`;
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
