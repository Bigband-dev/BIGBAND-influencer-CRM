"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CampaignForm() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("planning");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("캠페인명을 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name: name.trim(),
        brand: brand.trim() || null,
        product: product.trim() || null,
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/campaigns/${data.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border-2 border-slate-400 bg-white p-6">
        <h2 className="mb-5 text-lg font-bold">
          기본 정보
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="캠페인명 *"
            value={name}
            onChange={setName}
            placeholder="예: 풀무원 Reset 48"
          />

          <Field
            label="광고주"
            value={brand}
            onChange={setBrand}
            placeholder="예: 풀무원"
          />

          <Field
            label="제품 / 서비스"
            value={product}
            onChange={setProduct}
            placeholder="Reset 48"
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
              setDescription(e.target.value)
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
          onClick={() => router.back()}
          className="rounded-lg border-2 border-slate-400 bg-white px-5 py-2.5 text-sm font-semibold"
        >
          취소
        </button>

        <button
          disabled={loading}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {loading ? "생성 중..." : "캠페인 생성"}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2.5"
      />
    </div>
  );
}