import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-slate-900 text-white">
      <div className="border-b border-slate-700 px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Influencer CRM
        </p>

        <h1 className="mt-1 text-xl font-bold">
          Castbase DB
        </h1>
      </div>

      <nav className="space-y-2 px-4 py-6">
        <Link
          href="/influencers"
          className="block rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium"
        >
          인플루언서 DB
        </Link>

        <Link
          href="/influencers/import"
          className="block rounded-lg px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Excel 업로드
        </Link>

        <Link
          href="/campaigns"
          className="block rounded-lg px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          캠페인
        </Link>
      </nav>

      <div className="absolute bottom-0 left-0 w-full border-t border-slate-700 px-6 py-5">
        <p className="text-xs text-slate-400">
          Internal Management Tool
        </p>
      </div>
    </aside>
  );
}