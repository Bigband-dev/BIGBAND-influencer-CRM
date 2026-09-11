import CampaignForm from "@/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-8">
        <h1 className="mt-1 text-3xl font-bold">
          캠페인 생성
        </h1>
      </div>

      <CampaignForm />
    </div>
  );
}