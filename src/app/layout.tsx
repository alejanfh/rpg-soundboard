import type { Metadata, Viewport } from "next";
import { Jost, Limelight } from "next/font/google";
import "./globals.css";

// Limelight: 1930s picture-palace Art Deco, for titles only.
const limelight = Limelight({
  variable: "--font-limelight",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

// Jost: a Futura-like geometric sans (Futura is 1927) that stays legible small.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Mesa de sonido",
  description: "Mesa de sonido para partidas de rol",
};

export const viewport: Viewport = {
  themeColor: "#0a1e22",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${limelight.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
