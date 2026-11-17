Google OAuth GET Route Handler prerender fix

문제:
- cacheComponents 환경에서 GET Route Handler가 build-time prerender를 시도함
- createRouteSupabaseClient() 내부 request.cookies.getAll() 접근 시
  NEXT_PRERENDER_INTERRUPTED 발생

수정:
- app/api/google/oauth/start/route.ts
- app/api/google/oauth/callback/route.ts

두 GET handler 시작부에:
  await connection();

추가하고 next/server에서 connection을 import함.

route-client.ts는 변경하지 않음.

Next.js 공식 권장 패턴:
GET Route Handler에서 request.url / request.headers / request.cookies 등
Request 정보를 읽기 전에 await connection()을 호출하면 이후 코드는
runtime request에서만 실행됨.
