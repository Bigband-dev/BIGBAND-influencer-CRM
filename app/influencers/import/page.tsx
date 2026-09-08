import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExcelImport from "@/components/excel-import";

export default async function ImportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/influencers"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← 인플루언서 목록
        </Link>

        <div className="mb-8 mt-5">
          <p className="text-sm font-medium text-slate-500">
            Influencer Management
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Excel 일괄 업로드
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            기존 인플루언서 Excel 파일을 DB에 추가하거나 업데이트합니다.
          </p>
        </div>

        <ExcelImport />
      </div>
    </main>
  );
}