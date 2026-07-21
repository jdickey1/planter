import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL("https://linkplanter.com"),
  title: "LinkPlanter - Plant Links. Grow Rankings.",
  description: "Build powerful backlinks by submitting your business to 100+ web directories. Smart recommendations, campaign tracking, and your own directory listings. Start free, grow fast.",
  keywords: "directory submission, backlinks, SEO, local SEO, business directories, link building, search rankings",
  authors: [{ name: "LinkPlanter" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "LinkPlanter - Plant Links. Grow Rankings.",
    description: "Build powerful backlinks by submitting your business to 100+ web directories.",
    url: "https://linkplanter.com",
    siteName: "LinkPlanter",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkPlanter - Plant Links. Grow Rankings.",
    description: "Build powerful backlinks by submitting your business to 100+ web directories.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#22C55E" />
      </head>
      <body className="antialiased">
        {children}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            defer
            src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
      </body>
    </html>
  );
}
