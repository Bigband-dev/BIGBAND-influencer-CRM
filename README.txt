멀티 시트 엑셀 업로드 수정본

수정 사항
1. '카테고리2 (없으면X)'를 2번째 카테고리로 우선 정확히 매칭
2. 1차 카테고리 자동 매핑에서 카테고리2/2차/보조 카테고리 헤더 제외
3. 업로드 화면의 플랫폼 매핑 항목 제거
4. 플랫폼은 기존처럼 시트명(IG/YT/NB)에서 자동 판별

교체 파일
- components/excel-import.tsx


표준 엑셀 양식 다운로드 기능
- 엑셀 업로드 화면의 파일 선택 영역에 '표준 양식 다운로드' 버튼 추가
- 버튼 클릭 시 아래 정적 파일 다운로드:
  /templates/influencer-standard-template.xlsx
- 실제 제공 파일은 사용자가 업로드한 '인플루언서 표준 엑셀 양식(1).xlsx'를 그대로 사용

추가/교체 파일
- components/excel-import.tsx
- public/templates/influencer-standard-template.xlsx

별도 API나 DB 변경 없음.


TypeScript build hotfix
- 플랫폼 매핑 항목을 UI 목록에서 제거한 뒤 남아 있던
  field === "platform" 조건을 제거했습니다.
- channel_handle의 '선택' 표시만 유지합니다.
- TS2367 빌드 오류 해결용 수정입니다.
