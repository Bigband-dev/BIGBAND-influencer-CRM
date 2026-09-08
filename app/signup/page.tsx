"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignup = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setMessage("");

    if (!email.endsWith("@bigband.co.kr")) {
      setMessage(
        "회사 이메일(@bigband.co.kr)만 가입할 수 있습니다."
      );
      return;
    }

    if (password.length < 8) {
      setMessage(
        "비밀번호는 8자 이상 입력해주세요."
      );
      return;
    }

    if (password !== passwordConfirm) {
      setMessage(
        "비밀번호가 일치하지 않습니다."
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요."
    );

    setTimeout(() => {
      router.push("/login");
    }, 2000);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
      <div className="w-full max-w-md rounded-xl border-2 border-slate-400 bg-white p-8 shadow-sm">

        <p className="text-sm font-semibold text-slate-500">
          Influencer CRM
        </p>

        <h1 className="mt-1 text-2xl font-bold">
          회원가입
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          회사 계정을 생성합니다.
        </p>

        <form
          onSubmit={handleSignup}
          className="mt-7 space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              이름
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
              className="w-full rounded-lg border-2 border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              회사 이메일
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              placeholder="name@bigband.co.kr"
              className="w-full rounded-lg border-2 border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              비밀번호
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              className="w-full rounded-lg border-2 border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              비밀번호 확인
            </label>

            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) =>
                setPasswordConfirm(
                  e.target.value
                )
              }
              required
              className="w-full rounded-lg border-2 border-slate-300 px-4 py-3"
            />
          </div>

          {message && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
              {message}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "가입 중..."
              : "회원가입"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            className="font-semibold text-slate-900 hover:underline"
          >
            로그인
          </Link>
        </div>
      </div>
    </main>
  );
}