import GeneralBulkMail from "@/components/general-bulk-mail";

export default function MailPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            메일 보내기
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            캠페인과 관계없이 여러 수신자에게 동일한 내용의 메일을
            개별 발송합니다.
          </p>
        </div>

        <GeneralBulkMail />
      </div>
    </div>
  );
}
