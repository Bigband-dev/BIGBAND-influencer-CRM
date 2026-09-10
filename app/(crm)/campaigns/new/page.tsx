import CampaignForm from "@/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-slate-500">
          Campaign Management
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          캠페인 생성
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          새로운 캠페인의 기본 정보를 입력합니다.
        </p>
      </div>

      <CampaignForm />
    </div>
  );
}