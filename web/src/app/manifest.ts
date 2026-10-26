import type { MetadataRoute } from "next";

// Installable to the home screen: opens full screen, in Hebrew, right to left.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "אימונים ותזונה",
    short_name: "אימונים",
    description: "תיעוד אימוני כוח, התקדמות ותזונה, בעברית",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F4F2",
    theme_color: "#F3F4F2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
