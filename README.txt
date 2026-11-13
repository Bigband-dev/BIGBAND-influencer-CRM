MAIL PRERENDER BUILD FIX

문제:
- /mail/page.tsx 안에서 Supabase auth.getUser()를 직접 호출하면서
  cacheComponents / prerender 과정에서 NEXT_PRERENDER_INTERRUPTED가 발생했습니다.
- export const instant = false 만으로는 Vercel build의 prerender 경로를 완전히 피하지 못했습니다.

수정:
- /mail/page.tsx에서 아래를 모두 제거:
  * createClient import
  * supabase.auth.getUser()
  * redirect("/login")
  * export const instant = false
- /mail 페이지는 GeneralBulkMail UI만 렌더링하는 정적 route shell로 변경
- 실제 Gmail API route에서는 기존처럼 서버에서 사용자 인증을 검증하므로
  메일 발송 보안은 유지됩니다.
- (crm) 레이아웃의 기존 로그인 보호 구조는 그대로 사용합니다.

교체 파일:
app/(crm)/mail/page.tsx
