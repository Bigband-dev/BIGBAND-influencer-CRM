적용 순서

1. Supabase SQL Editor에서 supabase/migrations/20261109_email_recipient_history.sql 실행
2. 아래 파일 교체
   - components/campaign-email-modal.tsx
   - app/api/google/contacts/search/route.ts
   - app/api/gmail/send-bulk/route.ts
3. 재배포

동작
- 기존 campaign_email_sends의 To 주소를 최근 주소 캐시에 백필
- 앞으로 발송되는 To / CC / BCC 주소를 자동 저장
- 수신자 검색 시 최근 이력 + 회사 디렉터리 + 개인 연락처를 함께 검색
- 같은 이메일은 중복 제거
- 최근 이력은 검색 결과에서 우선 노출
