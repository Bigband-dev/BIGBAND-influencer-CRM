Google OAuth NEXT_PRERENDER_INTERRUPTED - cookie snapshot fix

이 버전은 이전 await connection() 패치보다 한 단계 더 강하게 처리합니다.

변경점
1. OAuth GET handler 시작부의 await connection() 유지
2. 그 직후 request.headers.get("cookie")를 딱 한 번 읽음
3. Cookie 헤더를 일반 {name, value}[] 배열로 변환
4. Supabase SSR client는 NextRequest.cookies가 아니라 이 스냅샷만 사용

따라서 Supabase auth.getUser() 내부에서 나중에 request.cookies.getAll()을
호출하면서 NEXT_PRERENDER_INTERRUPTED가 발생하는 경로를 제거합니다.

교체 파일
- lib/supabase/route-client.ts
- app/api/google/oauth/start/route.ts
- app/api/google/oauth/callback/route.ts

중요
- 세 파일을 모두 같이 교체하세요.
- export const dynamic = "force-dynamic"은 추가하지 않습니다.
- cacheComponents 설정은 그대로 유지합니다.
- app/api/influencers/refresh-stats/route.ts는 기존
  createRouteSupabaseClient(request) 호출을 계속 사용할 수 있습니다.
  POST handler는 prerender 대상이 아닙니다.

적용 후
npm run build

확인할 것
- lib/supabase/route-client.ts 로그에서 request.cookies.getAll()이 더 이상 나오지 않아야 함
- NEXT_PRERENDER_INTERRUPTED가 OAuth 경로에서 사라져야 함
