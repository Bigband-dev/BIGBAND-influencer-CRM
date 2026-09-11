"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/logout-button";
import { isAdmin } from "@/lib/auth/roles";

type SidebarProps = {
  userEmail: string;
  userName?: string;
  role: string;
};

export default function Sidebar({
  userEmail,
  userName,
  role,
}: SidebarProps) {
  const pathname = usePathname();

  const menuClass = (href: string) => {
    const active =
      pathname === href ||
      pathname.startsWith(`${href}/`);

    return active
      ? "block rounded-lg bg-slate-700 px-4 py-3 text-sm font-semibold text-white"
      : "block rounded-lg px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white";
  };

  const isInfluencers =
    pathname === "/influencers" ||
    (
      pathname.startsWith("/influencers/") &&
      !pathname.startsWith("/influencers/import")
    );

  const isCampaigns =
    pathname.startsWith("/campaigns");

  const isSearch =
    pathname.startsWith("/search");

  const isUsers =
    pathname.startsWith("/admin/users");

  const customMenuClass = (active: boolean) =>
    active
      ? "block rounded-lg bg-slate-700 px-4 py-3 text-sm font-semibold text-white"
      : "block rounded-lg px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r-2 border-slate-700 bg-slate-900 text-white">

      {/* 로고 */}
      <div className="border-b border-slate-700 px-6 py-6 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="Bigband logo"
          className="h-16 w-auto"
        />

        <p className="mt-3 text-base font-bold tracking-wider">
          BIGBAND 인플루언서 DB
        </p>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 space-y-2 px-4 py-6">

        <Link
          href="/influencers"
          className={customMenuClass(isInfluencers)}
        >
          인플루언서 DB
        </Link>

        <Link
          href="/campaigns"
          className={customMenuClass(isCampaigns)}
        >
          캠페인
        </Link>

        <Link
          href="/search"
          className={customMenuClass(isSearch)}
        >
          인플루언서 서칭
        </Link>

        {/* 관리자 메뉴 */}
        {isAdmin(role) && (
          <>
            <div className="my-5 border-t border-slate-700" />

            <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </p>

            <Link
              href="/admin/users"
              className={customMenuClass(isUsers)}
            >
              사용자 관리
            </Link>
          </>
        )}

      </nav>

      {/* 사용자 정보 */}
      <div className="border-t border-slate-700 px-6 py-5">

        <p className="truncate text-sm font-semibold text-white">
          {userName || userEmail}
        </p>

        <p className="mt-1 truncate text-xs text-slate-400">
          {userEmail}
        </p>

        <p className="mt-1 text-xs uppercase text-slate-500">
          {role}
        </p>

        <div className="mt-4">
          <LogoutButton />
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Made by Syorange
        </p>

      </div>

    </aside>
  );
}