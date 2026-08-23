"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/prep", label: "Prep Plan" },
  { href: "/design", label: "System Design" },
  { href: "/arena", label: "Arena" },
  { href: "/mock", label: "Mock" },
  { href: "/behavioral", label: "Behavioral" },
  { href: "/history", label: "History" },
];

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Interviewwee home">
      <span className="relative grid h-7 w-7 place-items-center rounded-md border border-white/12 bg-white/3">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 transition group-hover:bg-sky-300" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-neutral-100">
        Interviewwee
      </span>
    </Link>
  );
}

export default function SiteHeader({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#08080a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Wordmark />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/design"
                ? pathname === "/design" || pathname.startsWith("/replay")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-white/6 text-neutral-100"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">{actions}</div>
      </div>
    </header>
  );
}
