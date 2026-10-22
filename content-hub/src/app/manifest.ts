import type { MetadataRoute } from "next";

// Lets the hub be added to a phone's home screen (or installed from Chrome on
// a laptop) and open full screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Content Hub",
    short_name: "Hub",
    description: "Idea to posted, in one place, with Claude built in.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Ask Claude", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
