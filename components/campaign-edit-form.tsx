"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  brand: string | null;
  product: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
};

export default function CampaignEditForm({
  campaign,
}: {
  campaign: Campaign;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] =
    useState(campaign.name ?? "");

  const [brand, setBrand] =
    useState(campaign.brand ?? "");

  const [product, setProduct] =
    useState(campaign.product ?? "");

  const [description, setDescription] =
    useState(campaign.description ?? "");

  const [startDate, setStartDate] =
    useState(campaign.start_date ?? "");

  const [endDate, setEndDate] =
    useState(campaign.end_date ?? "");

  const [status, setStatus] =
    useState(campaign.status ?? "planning");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name.trim()) {
      setMessage(
        "캠페인명을 입력해주세요."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("campaigns")
      .update({
        name: name.trim(),
        brand: brand.trim() || null,
        product: product.trim() || null,
        description:
          description.trim() || null,
        start_date:
          startDate || null,
        end_date:
          endDate || null,
        status,
      })
      .eq("id", campaign.id);

    setLoading(false);

    if (error) {
      setMessage(
        `수정 실패: ${error.message}`
      );
      return;
    }

    router.push(
      `/campaigns/${campaign.id}`
    );

    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <section className="rounded-xl border-2 border-slate-400 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="캠페인명 *"
            value={name}
            onChange={setName}
          />

          <Field
            label="광고주"
            value={brand}
            onChange={setBrand}
          />

          <Field
            label="제품 / 서비스"
            value={product}
            onChange={setProduct}
          />

          <div>
            <label className="mb-2 block text-sm font-medium">
              상태
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
              className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2.5"
            >
              <option value="planning">
                준비 중
              </option>

              <option value="ongoing">
                진행 중
              </option>

              <option value="completed">
                진행 완료
              </option>

              <option value="cancelled">
                취소
              </option>
            </select>
          </div>

          <Field
            label="시작일"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />

          <Field
            label="종료일"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium">
            캠페인 설명
          </label>

          <textarea
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            rows={5}
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3"
          />
        </div>
      </section>

      {message && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="rounded-lg border-2 border-slate-400 bg-white px-5 py-2.5 text-sm font-semibold"
        >
          취소
        </button>

        <button
          disabled={loading}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loading
            ? "저장 중..."
            : "변경사항 저장"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2.5"
      />
    </div>
  );
}