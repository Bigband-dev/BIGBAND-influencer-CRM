캠페인 선택 인플루언서 Apify 데이터 최신화 기능

추가/교체 파일
1. components/campaign-influencer-manager.tsx
2. app/api/influencers/refresh-stats/route.ts
3. supabase/migrations/20261117_add_channel_refresh_stats.sql

기능
- 캠페인에서 체크한 인플루언서만 최신화
- 현재 1차 버전은 Instagram 대상
- 선택 인원 계정을 한 번의 Apify Actor 실행으로 배치 처리
- 기존 Apify Instagram Profile Scraper 사용
  기본 Actor:
  dami_studio~instagram-profile-scraper
- 갱신 항목:
  followers
  avg_views
  ad_avg_views
  ad_posts_sampled
  stats_updated_at
  stats_source
- 광고성 게시물:
  #광고, #협찬, #유료광고, 제품제공, paid partnership,
  sponsored, #ad 등의 표기 또는 sponsored/paid-partnership 플래그
- 광고 평균 조회수:
  최신 광고성 게시물 중 조회수가 확인되는 최대 3개 평균
- 일반 평균 조회수:
  최신 게시물 중 조회수가 확인되는 최대 10개 평균
- 이미지처럼 조회수 값이 없는 게시물은 조회수 평균 계산에서 제외

Apify API Key
권장:
Vercel Environment Variables에 아래를 추가
APIFY_API_TOKEN=apify_api_...

선택:
APIFY_INSTAGRAM_PROFILE_ACTOR_ID=dami_studio~instagram-profile-scraper

APIFY_API_TOKEN이 서버에 없으면
'데이터 최신화' 클릭 시 브라우저 prompt로 1회 입력받습니다.
입력된 키는 DB에 저장하지 않습니다.

DB 적용 순서
1. Supabase SQL Editor에서
   supabase/migrations/20261117_add_channel_refresh_stats.sql 실행
2. 파일 교체/추가
3. Vercel 환경변수 APIFY_API_TOKEN 설정 권장
4. 재배포

UI
캠페인 인플루언서 체크
→ '선택 N명 데이터 최신화'
→ Apify batch 실행
→ DB 갱신
→ 성공/건너뜀/실패 및 최신 수치 표 표시

기존 기능 보존
- 체크박스 선택
- 후보/확정 분리
- 페이지네이션
- 일괄 진행상태 변경
- Gmail 메일
- 캠페인 제거
- DB에서 인플루언서 추가

주의
- 현재 YouTube/Naver Blog는 건드리지 않음
- Instagram 계정이 없는 선택 항목은 건너뜀
- 한 요청 최대 100명
- influencer_channels에 Instagram 채널이 없고 legacy instagram_id만 있으면
  Instagram channel row를 자동 생성함
- legacy influencers.followers/avg_views는 해당 Instagram 채널이 primary일 때만 동기화함
