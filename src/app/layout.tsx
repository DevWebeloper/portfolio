import type { Metadata, Viewport } from "next";
import { Geist, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Display: a tight, heavy grotesque for the name and card labels.
const display = Schibsted_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

// Text: small labels and the panel copy.
const text = Geist({
  variable: "--font-text",
  subsets: ["latin"],
});

const description =
  "Ghaith Alkawadri is a remote web developer in Egypt and the founder of OmiTech (tech & AI solutions): Angular and React front-ends, WordPress sites and open-source Linux software.";

export const metadata: Metadata = {
  title: "Ghaith Alkawadri, web developer & founder of OmiTech",
  description,
  authors: [{ name: "Ghaith Alkawadri", url: "https://github.com/DevWebeloper" }],
  openGraph: {
    title: "Ghaith Alkawadri, web developer & founder of OmiTech",
    description,
    url: "https://devwebeloper.github.io/portfolio/",
    siteName: "Ghaith Alkawadri",
    locale: "en_US",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
