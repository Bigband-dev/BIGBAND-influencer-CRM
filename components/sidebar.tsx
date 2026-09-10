"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const menuClass = (href: string) => {
    const active =
      pathname === href ||
      pathname.startsWith(`${href}/`);

    return active
      ? "block rounded-lg bg-slate-700 px-4 py-3 text-sm font-semibold text-white"
      : "block rounded-lg px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white";
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r-2 border-slate-700 bg-slate-900 text-white">

      <div className="border-b border-slate-700 px-6 py-6 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="Bigband logo"
          className="h-16 w-auto"
        />

        <p className="mt-3 text-base font-bold tracking-wider ">
          BIGBAND 인플루언서 DB
        </p>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        <Link
          href="/influencers"
          className={menuClass("/influencers")}
        >
          인플루언서 DB
        </Link>

        <Link
          href="/campaigns"
          className={menuClass("/campaigns")}
        >
          캠페인
        </Link>

        <Link
          href="/search"
          className={menuClass("/search")}
        >
          인플루언서 서칭
        </Link>
      </nav>

      <div className="border-t border-slate-700 px-6 py-5">
        <p className="text-xs text-slate-400">
          Made by Syorange
        </p>
      </div>
    </aside>
  );
}