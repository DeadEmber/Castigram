import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });

const pueblo = process.env.NEXT_PUBLIC_PUEBLO ?? "el pueblo";

export const metadata: Metadata = {
  title: "Castigram · El bando digital del pueblo",
  description: `La red vecinal de ${pueblo}. Bandos oficiales, muro vecinal y mercadillo.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <Navbar />
        <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
