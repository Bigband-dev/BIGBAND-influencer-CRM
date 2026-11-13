RECIPIENT PREVIEW CAROUSEL UPDATE

기능:
- 미리보기 API가 개별 발송 대상 전체의 실제 치환 결과를 반환합니다.
- 미리보기 화면에서 ← 이전 / 다음 → 으로 수신자별 메일을 확인합니다.
- 1/N, 확인 완료 N/N 상태를 표시합니다.
- 모든 수신자 미리보기를 최소 한 번 확인해야 발송 버튼이 활성화됩니다.
- To + BCC 개별 발송 모드와 함께 동작합니다.
- CC는 각 개별 메일에 공통으로 표시됩니다.
- 제목/본문/수신자/CC/BCC/BCC 개별발송 설정을 수정하면 기존 미리보기 검토 상태가 초기화됩니다.

교체 파일:
- components/campaign-email-modal.tsx
- app/api/gmail/send-bulk/route.ts
- lib/google/gmail.ts

DB migration 없음.
