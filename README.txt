일반 대량 메일 기능

새 경로
- /mail

추가 파일
- app/(crm)/mail/page.tsx
- components/general-bulk-mail.tsx
- app/api/gmail/send-general/route.ts

기존 기능 재사용
- /api/google/contacts/search
- lib/google/gmail.ts
- gmail_connections
- Gmail 서명
- Gmail OAuth

동작
1. 받는 사람(To) 검색/직접 입력
2. CC / BCC 검색/직접 입력
3. 제목/본문 작성
4. 제목/본문은 모든 To 수신자에게 그대로 사용
5. To 수신자는 각각 개별 메일 발송
6. CC / BCC는 각 개별 메일에 공통 적용
7. 미리보기에서 모든 To 수신자를 이전/다음으로 확인
8. 전부 확인한 뒤 발송

중요
- {{인플루언서명}}, {{브랜드}} 등 어떤 템플릿 치환도 하지 않습니다.
- 캠페인 ID를 요구하지 않습니다.
- campaign_email_sends 테이블에도 저장하지 않습니다.
- DB migration 없음.

사이드바
- SIDEBAR-PATCH.txt 참고
- /mail Link 한 줄만 기존 sidebar.tsx에 추가


사이드바 반영 완료
- components/sidebar.tsx 포함
- 캠페인 메뉴 바로 아래에 '메일 보내기' 추가
- /mail 경로 활성 상태 스타일 적용

최종 추가/교체 파일
- app/(crm)/mail/page.tsx
- components/general-bulk-mail.tsx
- app/api/gmail/send-general/route.ts
- components/sidebar.tsx
