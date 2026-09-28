"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  InfluencerChannel,
  InfluencerPlatform,
} from "@/types/influencer";
import {
  INFLUENCER_CATEGORIES,
} from "@/lib/influencer-categories";

type InfluencerFormValues = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  categories?: string[] | null;
  subcategory?: string | null;
  gender?: string | null;
  age_group?: string | null;
  collaboration_rate?: number | null;
  memo?: string | null;
  channels?: InfluencerChannel[];
  /*
   * 기존 DB 호환용
   * 완전히 멀티채널 구조로 이전한 뒤 제거 가능
   */
  instagram_id?: string | null;
  instagram_url?: string | null;
  followers?: number | null;
  avg_views?: number | null;
};

type ChannelFormValue = {
  id?: string;
  platform: InfluencerPlatform;
  channel_name: string;
  handle: string;
  url: string;
  followers: string;
  avg_views: string;
  collaboration_rate: string;
  is_primary: boolean;
  memo: string;
};

const PLATFORM_OPTIONS: {
  value: InfluencerPlatform;
  label: string;
}[] = [
  {
    value: "instagram",
    label: "Instagram",
  },
  {
    value: "youtube",
    label: "YouTube",
  },
  {
    value: "tiktok",
    label: "TikTok",
  },
  {
    value: "naver_blog",
    label: "Naver Blog",
  },
  {
    value: "xiaohongshu",
    label: "Xiaohongshu",
  },
];

function channelToFormValue(
  channel: InfluencerChannel
): ChannelFormValue {
  return {
    id: channel.id,
    platform: channel.platform,
    channel_name:
      channel.channel_name ?? "",
    handle:
      channel.handle ?? "",
    url:
      channel.url ?? "",
    followers:
      channel.followers != null
        ? String(channel.followers)
        : "",
    avg_views:
      channel.avg_views != null
        ? String(channel.avg_views)
        : "",
    collaboration_rate:
      channel.collaboration_rate != null
        ? String(channel.collaboration_rate)
        : "",
    is_primary:
      channel.is_primary,
    memo:
      channel.memo ?? "",
  };
}

function createEmptyChannel(
  isPrimary = false
): ChannelFormValue {
  return {
    platform: "instagram",
    channel_name: "",
    handle: "",
    url: "",
    followers: "",
    avg_views: "",
    collaboration_rate: "",
    is_primary: isPrimary,
    memo: "",
  };
}

export default function InfluencerForm({
  initialData,
}: {
  initialData?: InfluencerFormValues;
}) {
  const router = useRouter();
  const supabase =
    createClient();
  const isEdit =
    Boolean(initialData?.id);
  /*
   * 기본 정보
   */
  const [form, setForm] =
    useState({
      name:
        initialData?.name ?? "",
      email:
        initialData?.email ?? "",
      phone:
        initialData?.phone ?? "",
      subcategory:
        initialData?.subcategory ?? "",
      gender:
        initialData?.gender ?? "",
      age_group:
        initialData?.age_group ?? "",
      memo:
        initialData?.memo ?? "",
    });
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(
      initialData?.categories?.length
        ? initialData.categories
        : initialData?.category
          ? [initialData.category]
          : []
    );
  /*
   * 기존 channels가 있으면 사용.
   *
   * 아직 channels가 없는 구 데이터라면
   * 기존 Instagram 컬럼을 임시로 채널로 변환.
   */
  const initialChannels:
    ChannelFormValue[] =
    initialData?.channels &&
    initialData.channels.length > 0
      ? initialData.channels.map(
          channelToFormValue
        )
      : initialData?.instagram_id ||
          initialData?.instagram_url
        ? [
            {
              id: undefined,
              platform:
                "instagram",
              channel_name: "",
              handle:
                initialData
                  ?.instagram_id ??
                "",
              url:
                initialData
                  ?.instagram_url ??
                "",
              followers:
                initialData
                  ?.followers != null
                  ? String(
                      initialData.followers
                    )
                  : "",
              avg_views:
                initialData
                  ?.avg_views != null
                  ? String(
                      initialData.avg_views
                    )
                  : "",
              collaboration_rate:
                initialData
                  ?.collaboration_rate != null
                  ? String(
                      initialData.collaboration_rate
                    )
                  : "",
              is_primary: true,
              memo: "",
            },
          ]
        : [
            createEmptyChannel(
              true
            ),
          ];
  const [
    channels,
    setChannels,
  ] =
    useState<ChannelFormValue[]>(
      initialChannels
    );
  const [
    saving,
    setSaving,
  ] = useState(false);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");
  /*
   * 기본 정보 변경
   */
  const updateField = (
    key: keyof typeof form,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };
  const toggleCategory = (
    category: string
  ) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter(
            (item) => item !== category
          )
        : [...prev, category]
    );
  };
  /*
   * 채널 필드 변경
   */
  const updateChannel = (
    index: number,
    field:
      keyof ChannelFormValue,
    value:
      | string
      | boolean
      | InfluencerPlatform
  ) => {
    setChannels((prev) =>
      prev.map(
        (channel, i) =>
          i === index
            ? {
                ...channel,
                [field]:
                  value,
              }
            : channel
      )
    );
  };
  /*
   * 채널 추가
   */
  const addChannel = () => {
    setChannels((prev) => [
      ...prev,
      createEmptyChannel(
        prev.length === 0
      ),
    ]);
  };
  /*
   * 채널 삭제
   */
  const removeChannel = (
    index: number
  ) => {
    setChannels((prev) => {
      const removed =
        prev[index];
      const next =
        prev.filter(
          (_, i) =>
            i !== index
        );
      /*
       * 대표 채널을 삭제했다면
       * 남은 첫 번째 채널을 대표로 지정
       */
      if (
        removed?.is_primary &&
        next.length > 0
      ) {
        next[0] = {
          ...next[0],
          is_primary: true,
        };
      }
      return next;
    });
  };
  /*
   * 대표 채널 설정
   *
   * 항상 하나만 true
   */
  const setPrimaryChannel = (
    index: number
  ) => {
    setChannels((prev) =>
      prev.map(
        (channel, i) => ({
          ...channel,
          is_primary:
            i === index,
        })
      )
    );
  };
  /*
   * 저장
   */
  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setErrorMessage("");
    /*
     * 최소 한 개 채널 필요
     */
    if (
      channels.length === 0
    ) {
      setErrorMessage(
        "최소 한 개의 채널을 등록해주세요."
      );
      return;
    }
    /*
     * 각 채널은 이름 / ID / URL 중
     * 최소 하나는 있어야 함
     */
    const invalidChannel =
      channels.find(
        (channel) =>
          !channel.channel_name.trim() &&
          !channel.handle.trim() &&
          !channel.url.trim()
      );
    if (invalidChannel) {
      setErrorMessage(
        "각 채널에는 채널명, ID 또는 URL 중 하나 이상을 입력해주세요."
      );
      return;
    }
    /*
     * 대표 채널 확인
     */
    if (
      !channels.some(
        (channel) =>
          channel.is_primary
      )
    ) {
      setErrorMessage(
        "대표 채널을 하나 선택해주세요."
      );
      return;
    }
    setSaving(true);
    try {
      /*
       * 기존 구조 호환용.
       *
       * Instagram 채널이 있으면
       * 기존 instagram_* 컬럼도 같이 동기화.
       */
      const instagramChannel =
        channels.find(
          (channel) =>
            channel.platform ===
            "instagram"
        );
      const selectedPrimaryChannel = channels.find(
        (channel) => channel.is_primary
      );
      const influencerPayload = {
        name:
          form.name.trim() ||
          null,
        email:
          form.email.trim() ||
          null,
        phone:
          form.phone.trim() ||
          null,
        category:
          selectedCategories.length > 0
            ? selectedCategories[0]
            : null,
        categories:
          selectedCategories.length > 0
            ? selectedCategories
            : null,
        subcategory:
          form.subcategory.trim() ||
          null,
        gender:
          form.gender.trim() ||
          null,
        age_group:
          form.age_group.trim() ||
          null,
        collaboration_rate: selectedPrimaryChannel?.collaboration_rate
          ? Number(selectedPrimaryChannel.collaboration_rate)
          : null,
        memo:
          form.memo.trim() ||
          null,
        /*
         * 레거시 컬럼 동기화
         */
        instagram_id:
          instagramChannel
            ?.handle
            .trim()
            .replace(
              /^@/,
              ""
            ) || null,
        instagram_url:
          instagramChannel
            ?.url
            .trim() ||
          null,
        followers:
          instagramChannel
            ?.followers
            ? Number(
                instagramChannel.followers
              )
            : null,
        avg_views:
          instagramChannel
            ?.avg_views
            ? Number(
                instagramChannel.avg_views
              )
            : null,
        updated_at:
          new Date().toISOString(),
      };
      let influencerId:
        string;
      /*
       * 1. influencer 기본 정보 저장
       */
      if (
        isEdit &&
        initialData?.id
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              "influencers"
            )
            .update(
              influencerPayload
            )
            .eq(
              "id",
              initialData.id
            );
        if (error) {
          throw error;
        }
        influencerId =
          initialData.id;
      } else {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "influencers"
            )
            .insert(
              influencerPayload
            )
            .select("id")
            .single();
        if (error) {
          throw error;
        }
        if (!data?.id) {
          throw new Error(
            "인플루언서 ID를 생성하지 못했습니다."
          );
        }
        influencerId =
          data.id;
      }
      /*
       * 2. 기존 DB 채널 ID 확인
       */
      const existingChannelIds =
        (
          initialData
            ?.channels ??
          []
        )
          .map(
            (channel) =>
              channel.id
          )
          .filter(
            (
              id
            ): id is string =>
              Boolean(id)
          );
      const currentChannelIds =
        channels
          .map(
            (channel) =>
              channel.id
          )
          .filter(
            (
              id
            ): id is string =>
              Boolean(id)
          );
      /*
       * 폼에서 삭제된 기존 채널
       */
      const removedChannelIds =
        existingChannelIds.filter(
          (id) =>
            !currentChannelIds.includes(
              id
            )
        );
      if (
        removedChannelIds.length >
        0
      ) {
        const {
          error:
            deleteError,
        } =
          await supabase
            .from(
              "influencer_channels"
            )
            .delete()
            .in(
              "id",
              removedChannelIds
            );
        if (deleteError) {
          throw deleteError;
        }
      }
      /*
       * unique primary index 충돌 방지를 위해
       * 현재 모든 채널의 대표 상태를 먼저 해제
       */
      const {
        error:
          clearPrimaryError,
      } =
        await supabase
          .from(
            "influencer_channels"
          )
          .update({
            is_primary:
              false,
          })
          .eq(
            "influencer_id",
            influencerId
          );
      if (
        clearPrimaryError
      ) {
        throw clearPrimaryError;
      }
      /*
       * 대표 채널 index
       */
      const primaryIndex =
        channels.findIndex(
          (channel) =>
            channel.is_primary
        );
      let primaryChannelId:
        string | null =
        null;
      /*
       * 3. 채널 각각 update / insert
       */
      for (
        let index = 0;
        index <
        channels.length;
        index++
      ) {
        const channel =
          channels[index];
        const channelPayload = {
          influencer_id:
            influencerId,
          platform:
            channel.platform,
          channel_name:
            channel.channel_name
              .trim() ||
            null,
          handle:
            channel.handle
              .trim()
              .replace(
                /^@/,
                ""
              ) ||
            null,
          url:
            channel.url
              .trim() ||
            null,
          followers:
            channel.followers
              ? Number(
                  channel.followers
                )
              : null,
          avg_views:
            channel.avg_views
              ? Number(
                  channel.avg_views
                )
              : null,
          collaboration_rate: channel.collaboration_rate
            ? Number(channel.collaboration_rate)
            : null,
          /*
           * 마지막 단계에서
           * 대표 채널만 true로 변경
           */
          is_primary: false,
          memo:
            channel.memo
              .trim() ||
            null,
          updated_at:
            new Date().toISOString(),
        };
        if (channel.id) {
          /*
           * 기존 채널 수정
           */
          const {
            error:
              updateError,
          } =
            await supabase
              .from(
                "influencer_channels"
              )
              .update(
                channelPayload
              )
              .eq(
                "id",
                channel.id
              );
          if (updateError) {
            throw updateError;
          }
          if (
            index ===
            primaryIndex
          ) {
            primaryChannelId =
              channel.id;
          }
        } else {
          /*
           * 신규 채널 생성
           */
          const {
            data,
            error: insertError,
          } = await supabase
            .from("influencer_channels")
            .insert(channelPayload)
            .select("id")
            .single();
          if (insertError) {
            console.error(
              "CHANNEL INSERT ERROR",
              {
                channelPayload,
                insertError,
              }
            );
            throw insertError;
          }
          if (
            index ===
            primaryIndex
          ) {
            primaryChannelId =
              data.id;
          }
        }
      }
      /*
       * 4. 대표 채널 지정
       */
      if (
        primaryChannelId
      ) {
        const {
          error:
            primaryError,
        } =
          await supabase
            .from(
              "influencer_channels"
            )
            .update({
              is_primary:
                true,
            })
            .eq(
              "id",
              primaryChannelId
            );
        if (
          primaryError
        ) {
          throw primaryError;
        }
      }
      /*
       * 완료 후
       * 신규 등록 -> 목록
       * 수정 -> 상세 페이지
       */
      if (isEdit) {
        router.push(
          `/influencers/${influencerId}`
        );
      } else {
        router.push(
          "/influencers"
        );
      }
      router.refresh();
    } catch (error: any) {
      console.error(
        "Influencer save error:",
        {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          error,
        }
      );
      const message =
        error?.message ||
        error?.details ||
        "저장 중 오류가 발생했습니다.";
      if (
        message.includes(
          "duplicate key value"
        )
      ) {
        setErrorMessage(
          "이미 등록된 채널 ID 또는 중복된 데이터가 있습니다."
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-6"
    >
      {/* 기본 정보 */}
      <section className="rounded-xl border border-slate-300 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">
          기본 정보
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="이름"
            value={
              form.name
            }
            onChange={(
              value
            ) =>
              updateField(
                "name",
                value
              )
            }
          />
          <Field
            label="이메일"
            value={
              form.email
            }
            onChange={(
              value
            ) =>
              updateField(
                "email",
                value
              )
            }
          />
          <Field
            label="전화번호"
            value={
              form.phone
            }
            onChange={(
              value
            ) =>
              updateField(
                "phone",
                value
              )
            }
          />
          <Field
            label="성별"
            value={
              form.gender
            }
            onChange={(
              value
            ) =>
              updateField(
                "gender",
                value
              )
            }
          />
          <Field
            label="연령대"
            value={
              form.age_group
            }
            onChange={(
              value
            ) =>
              updateField(
                "age_group",
                value
              )
            }
            placeholder="20대, 30대 등"
          />
          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-slate-700">
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {INFLUENCER_CATEGORIES.map((category) => {
                const selected =
                  selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      toggleCategory(category)
                    }
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              여러 카테고리를 선택할 수 있습니다.
            </p>
          </div>
          <Field
            label="세부 카테고리"
            value={form.subcategory}
            onChange={(value) =>
              updateField(
                "subcategory",
                value
              )
            }
            placeholder="필요한 경우 입력"
          />
        </div>
      </section>
      {/* 채널 정보 */}
      <section className="rounded-xl border border-slate-300 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              채널 정보
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Instagram,
              YouTube, TikTok,
              Blog 등 여러
              채널을 등록할 수
              있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={
              addChannel
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + 채널 추가
          </button>
        </div>
        {channels.length ===
          0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
            <p className="text-sm text-slate-500">
              등록된 채널이
              없습니다.
            </p>
            <button
              type="button"
              onClick={
                addChannel
              }
              className="mt-3 text-sm font-semibold text-slate-900 underline"
            >
              첫 채널 추가
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {channels.map(
              (
                channel,
                index
              ) => (
                <div
                  key={
                    channel.id ??
                    `new-${index}`
                  }
                  className={`rounded-xl border p-5 ${
                    channel.is_primary
                      ? "border-slate-500 bg-slate-50"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {/* 채널 헤더 */}
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        채널{" "}
                        {index +
                          1}
                      </span>
                      {channel.is_primary && (
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                          대표 채널
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="radio"
                          name="primary-channel"
                          checked={
                            channel.is_primary
                          }
                          onChange={() =>
                            setPrimaryChannel(
                              index
                            )
                          }
                          className="h-4 w-4"
                        />
                        대표 채널
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          removeChannel(
                            index
                          )
                        }
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* 플랫폼 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        플랫폼
                      </label>
                      <select
                        value={
                          channel.platform
                        }
                        onChange={(
                          e
                        ) =>
                          updateChannel(
                            index,
                            "platform",
                            e
                              .target
                              .value as InfluencerPlatform
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                      >
                        {PLATFORM_OPTIONS.map(
                          (
                            option
                          ) => (
                            <option
                              key={
                                option.value
                              }
                              value={
                                option.value
                              }
                            >
                              {
                                option.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <Field
                      label="채널명"
                      value={
                        channel.channel_name
                      }
                      onChange={(
                        value
                      ) =>
                        updateChannel(
                          index,
                          "channel_name",
                          value
                        )
                      }
                      placeholder="예: 민지로그"
                    />
                    <Field
                      label="채널 ID / 핸들"
                      value={
                        channel.handle
                      }
                      onChange={(
                        value
                      ) =>
                        updateChannel(
                          index,
                          "handle",
                          value
                        )
                      }
                      placeholder="@ 없이 입력"
                    />
                    <Field
                      label="채널 URL"
                      value={
                        channel.url
                      }
                      onChange={(
                        value
                      ) =>
                        updateChannel(
                          index,
                          "url",
                          value
                        )
                      }
                      placeholder="https://..."
                    />
                    <Field
                      label="팔로워 (명)"
                      type="number"
                      value={
                        channel.followers
                      }
                      onChange={(
                        value
                      ) =>
                        updateChannel(
                          index,
                          "followers",
                          value
                        )
                      }
                    />
                    <Field
                      label="평균 조회수 (회)"
                      type="number"
                      value={
                        channel.avg_views
                      }
                      onChange={(
                        value
                      ) =>
                        updateChannel(
                          index,
                          "avg_views",
                          value
                        )
                      }
                    />
                    <Field
                      label="최근 협업 단가 (만원)"
                      type="number"
                      value={channel.collaboration_rate}
                      onChange={(value) =>
                        updateChannel(index, "collaboration_rate", value)
                      }
                      placeholder="예: 150"
                    />
                  </div>
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      채널 메모
                    </label>
                    <textarea
                      value={
                        channel.memo
                      }
                      onChange={(
                        e
                      ) =>
                        updateChannel(
                          index,
                          "memo",
                          e
                            .target
                            .value
                        )
                      }
                      rows={
                        2
                      }
                      placeholder="채널별 특이사항"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
      {/* 내부 메모 */}
      <section className="rounded-xl border border-slate-300 bg-white p-6">
        <h2 className="mb-5 text-lg font-semibold">
          내부 메모
        </h2>
        <textarea
          value={
            form.memo
          }
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
      {/* 에러 */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {
            errorMessage
          }
        </div>
      )}
      {/* 하단 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          disabled={
            saving
          }
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={
            saving
          }
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
  onChange: (
    value: string
  ) => void;
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
          onChange(
            e.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
      />
    </div>
  );
}
