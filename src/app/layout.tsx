import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Sidebar from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

import PositionProvider from "@/components/PositionProvider";
import AutoCloseMonitor from "@/components/AutoCloseMonitor";

export const metadata: Metadata = {
  title: "Meteora LP | DLMM Position Manager",
  description:
    "Manage your Meteora DLMM liquidity positions — track bins, monitor health, and optimize your LP strategy on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex bg-[#0a0b0f] text-foreground">
        <WalletProvider>
          <PositionProvider>
            <AutoCloseMonitor>
              <TooltipProvider>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">{children}</main>
              </TooltipProvider>
            </AutoCloseMonitor>
          </PositionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
