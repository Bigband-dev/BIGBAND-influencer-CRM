"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type InfluencerFormValues = {
  id?: string;
  name?: string | null;
  instagram_id?: string | null;
  instagram_url?: string | null;
  email?: string | null;
  phone?: string | null;
  followers?: number | null;
  avg_views?: number | null;
  category?: string | null;
  subcategory?: string | null;
  gender?: string | null;
  age_group?: string | null;
  collaboration_rate?: number | null;
  memo?: string | null;
};

export default function InfluencerForm({
  initialData,
}: {
  initialData?: InfluencerFormValues;
}) {
  const router = useRouter();
  const supabase = createClient();

  const isEdit = Boolean(initialData?.id);

  const [form, setForm] = useState({
    name: initialData?.name ?? "",
    instagram_id: initialData?.instagram_id ?? "",
    instagram_url: initialData?.instagram_url ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    followers: initialData?.followers?.toString() ?? "",
    avg_views: initialData?.avg_views?.toString() ?? "",
    category: initialData?.category ?? "",
    subcategory: initialData?.subcategory ?? "",
    gender: initialData?.gender ?? "",
    age_group: initialData?.age_group ?? "",
    collaboration_rate:
      initialData?.collaboration_rate?.toString() ?? "",
    memo: initialData?.memo ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const updateField = (
    key: keyof typeof form,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!form.instagram_id.trim()) {
      setErrorMessage("Instagram ID는 필수입니다.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const payload = {
      name: form.name.trim() || null,
      instagram_id: form.instagram_id
        .trim()
        .replace(/^@/, ""),
      instagram_url:
        form.instagram_url.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,

      followers: form.followers
        ? Number(form.followers)
        : null,

      avg_views: form.avg_views
        ? Number(form.avg_views)
        : null,

      category: form.category.trim() || null,
      subcategory:
        form.subcategory.trim() || null,
      gender: form.gender.trim() || null,
      age_group:
        form.age_group.trim() || null,

      collaboration_rate:
        form.collaboration_rate
          ? Number(form.collaboration_rate)
          : null,

      memo: form.memo.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;

    if (isEdit && initialData?.id) {
      const result = await supabase
        .from("influencers")
        .update(payload)
        .eq("id", initialData.id);

      error = result.error;
    } else {
      const result = await supabase
        .from("influencers")
        .insert(payload);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      if (
        error.message.includes(
          "duplicate key value"
        )
      ) {
        setErrorMessage(
          "이미 등록된 Instagram ID입니다."
        );
      } else {
        setErrorMessage(error.message);
      }

      return;
    }

    router.push("/influencers");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">
          기본 정보
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="이름"
            value={form.name}
            onChange={(value) =>
              updateField("name", value)
            }
          />

          <Field
            label="Instagram ID *"
            value={form.instagram_id}
            onChange={(value) =>
              updateField(
                "instagram_id",
                value
              )
            }
            placeholder="example_id"
          />

          <Field
            label="Instagram URL"
            value={form.instagram_url}
            onChange={(value) =>
              updateField(
                "instagram_url",
                value
              )
            }
          />

          <Field
            label="이메일"
            value={form.email}
            onChange={(value) =>
              updateField("email", value)
            }
          />

          <Field
            label="전화번호"
            value={form.phone}
            onChange={(value) =>
              updateField("phone", value)
            }
          />

          <Field
            label="성별"
            value={form.gender}
            onChange={(value) =>
              updateField("gender", value)
            }
          />

          <Field
            label="연령대"
            value={form.age_group}
            onChange={(value) =>
              updateField(
                "age_group",
                value
              )
            }
            placeholder="20대, 30대 등"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">
          채널 정보
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="카테고리"
            value={form.category}
            onChange={(value) =>
              updateField(
                "category",
                value
              )
            }
          />

          <Field
            label="세부 카테고리"
            value={form.subcategory}
            onChange={(value) =>
              updateField(
                "subcategory",
                value
              )
            }
          />

          <Field
            label="팔로워"
            type="number"
            value={form.followers}
            onChange={(value) =>
              updateField(
                "followers",
                value
              )
            }
          />

          <Field
            label="평균 조회수"
            type="number"
            value={form.avg_views}
            onChange={(value) =>
              updateField(
                "avg_views",
                value
              )
            }
          />

          <Field
            label="협업 단가"
            type="number"
            value={
              form.collaboration_rate
            }
            onChange={(value) =>
              updateField(
                "collaboration_rate",
                value
              )
            }
            placeholder="원 단위"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">
          내부 메모
        </h2>

        <textarea
          value={form.memo}
          onChange={(e) =>
            updateField(
              "memo",
              e.target.value
            )
          }
          rows={6}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
          placeholder="인플루언서 관련 내부 메모"
        />
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium"
        >
          취소
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving
            ? "저장 중..."
            : isEdit
              ? "수정 저장"
              : "인플루언서 추가"}
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
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
      />
    </div>
  );
}