Google OAuth NEXT_PRERENDER_INTERRUPTED 재적용 패치

현재 오류:
lib/supabase/route-client.ts
request.cookies.getAll()
digest: NEXT_PRERENDER_INTERRUPTED

원인:
cacheComponents가 켜진 Next.js 빌드에서
Google OAuth GET Route Handler가 prerender 대상으로 평가되면서
실제 요청 객체의 cookies를 build-time에 읽으려 한 문제입니다.

필수 교체 파일:
1. app/api/google/oauth/start/route.ts
2. app/api/google/oauth/callback/route.ts

두 GET handler는 request.cookies / request.nextUrl 등을 읽기 전에:
  await connection();

을 실행합니다.

lib/supabase/route-client.ts는 현재 request.cookies 기반 구조를 유지합니다.
next/headers의 cookies()로 되돌리지 마세요.

적용 순서:
1. 위 두 route.ts 파일을 프로젝트의 동일 경로에 덮어쓰기
2. 기존 lib/supabase/route-client.ts는 이 ZIP 버전과 다르면 같이 교체
3. git add / commit / push
4. Vercel에서 새 배포
5. 빌드 로그에서 NEXT_PRERENDER_INTERRUPTED가 사라지는지 확인

주의:
- export const dynamic = "force-dynamic" 같은 route segment config는
  현재 프로젝트의 cacheComponents 설정과 충돌할 수 있으므로 사용하지 않습니다.
- Apify refresh-stats POST route와는 무관한 오류입니다.
