import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ProductProvider } from "@/components/providers/ProductProvider";
import { SiteNav } from "@/components/nav/SiteNav";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura — Blind giving",
  description: "Donate to Aura. We allocate to causes behind the scenes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="aura-bg flex min-h-full flex-col font-sans">
        <AuthProvider>
          <ProductProvider>
            <SiteNav />
            <main className="flex flex-1 flex-col">{children}</main>
          </ProductProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
