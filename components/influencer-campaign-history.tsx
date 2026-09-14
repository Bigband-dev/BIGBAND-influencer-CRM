"use client";

import { useRouter } from "next/navigation";

type CampaignHistoryItem = {
  id: string;
  status: string | null;
  proposed_rate: number | null;
  final_rate: number | null;
  campaigns:
    | {
        id: string;
        name: string;
        brand: string | null;
        start_date: string | null;
        end_date: string | null;
      }
    | {
        id: string;
        name: string;
        brand: string | null;
        start_date: string | null;
        end_date: string | null;
      }[]
    | null;
};

export default function InfluencerCampaignHistory({
  items,
}: {
  items: CampaignHistoryItem[];
}) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-5 py-3 text-left">
              캠페인
            </th>

            <th className="px-5 py-3 text-left">
              광고주
            </th>

            <th className="px-5 py-3 text-center">
              상태
            </th>

            <th className="px-5 py-3 text-left">
              기간
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-300">
          {items.map((item) => {
            const campaign =
              Array.isArray(item.campaigns)
                ? item.campaigns[0]
                : item.campaigns;

            if (!campaign) {
              return null;
            }

            return (
              <tr
                key={item.id}
                onClick={() =>
                  router.push(
                    `/campaigns/${campaign.id}`
                  )
                }
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-5 py-4 font-semibold">
                  {campaign.name}
                </td>

                <td className="px-5 py-4">
                  {campaign.brand || "-"}
                </td>

                <td className="px-5 py-4 text-center">
                  {item.status || "-"}
                </td>

                <td className="px-5 py-4">
                  {campaign.start_date || "-"}
                  {" ~ "}
                  {campaign.end_date || "-"}
                </td>
              </tr>
            );
          })}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-10 text-center text-slate-400"
              >
                캠페인 이력이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}