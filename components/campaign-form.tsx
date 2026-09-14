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
  
  const [purpose, setPurpose] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [budget, setBudget] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const PLATFORM_OPTIONS = [
    "Instagram",
    "YouTube",
    "TikTok",
    "Blog",
    "Threads",
    "기타",
  ];

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((item) => item !== platform)
        : [...prev, platform]
    );
  };

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

        purpose: purpose.trim() || null,
        platforms,
        budget: budget
          ? Number(budget.replace(/,/g, ""))
          : null,

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
          캠페인 정보 입력
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
                진행 중단
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
        <div>
          <label className="mb-2 block text-sm font-medium">
            캠페인 예산 (만원)
          </label>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="예: 3000"
              className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2.5"
            />

            <span className="whitespace-nowrap text-sm text-slate-500">
              만원
            </span>
          </div>
        </div>
        <div className="mt-5">
          <label className="mb-3 block text-sm font-medium">
            진행 플랫폼
          </label>

          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((platform) => {
              const selected =
                platforms.includes(platform);

              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() =>
                    togglePlatform(platform)
                  }
                  className={
                    selected
                      ? "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  }
                >
                  {platform}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium">
            캠페인 목적
          </label>

          <textarea
            value={purpose}
            onChange={(e) =>
              setPurpose(e.target.value)
            }
            rows={3}
            placeholder="예: 신제품 인지도 확대 및 체험 콘텐츠 확보"
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3"
          />
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium">
            메모
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