"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "./WalletButton";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "◈" },
  { href: "/pools", label: "Pools", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "⚙", disabled: true },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
          <span className="text-lg font-bold text-white">M</span>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 opacity-50 blur-md -z-10" />
        </div>
        <div>
          <h1 className="text-base font-bold bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
            Meteora LP
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
            DLMM Manager
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-teal-500/10 text-teal-400 shadow-sm shadow-teal-500/5"
                    : item.disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>

            </Link>
          );
        })}
      </nav>

      {/* Wallet Section */}
      <div className="px-4 py-4 border-t border-white/5">
        <WalletButton />
      </div>
    </aside>
  );
}
