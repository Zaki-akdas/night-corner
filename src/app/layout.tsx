import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FloatingWhatsApp } from "@/components/layout/floating-whatsapp";
import { getSettings } from "@/lib/settings";
import { CartProvider } from "@/components/cart/cart-context";
import { ToastHost } from "@/components/ui/toast";
import { PWAInit } from "@/components/pwa-init";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://nightcorner.in"),
  title: {
    default: "NIGHT CORNER — Your Night. Your Essentials.",
    template: "%s · NIGHT CORNER",
  },
  description:
    "Late-night snacks, bakery, chocolates, instant food and drinks delivered to your door. Open 10 PM – 6 AM, within 10 KM.",
  keywords: [
    "late night delivery",
    "midnight snacks",
    "night delivery Indore",
    "Maggi delivery",
    "night corner",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    // PNG (not SVG) — iOS Safari ignores SVG apple-touch-icons.
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "NIGHT CORNER — Your Night. Your Essentials.",
    description:
      "Late-night snacks, bakery, chocolates, instant food and drinks delivered to your door.",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "NIGHT CORNER",
    description: "Your Night. Your Essentials.",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <CartProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header settings={settings} />
              <main className="flex-1">{children}</main>
              <Footer settings={settings} />
            </div>
            <FloatingWhatsApp whatsappNumber={settings.whatsappNumber} />
            <ToastHost />
            <PWAInit />
          </CartProvider>
        </Providers>
      </body>
    </html>
  );
}
