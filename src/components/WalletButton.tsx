"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";

export default function WalletButton() {
  const { wallet, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono text-foreground/80">
            {truncatedAddress}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnect()}
          className="text-muted-foreground hover:text-destructive text-xs"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-semibold shadow-lg shadow-teal-500/20 transition-all duration-300 hover:shadow-teal-500/40 hover:scale-[1.02]"
    >
      {connecting ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Connecting...
        </span>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  );
}
