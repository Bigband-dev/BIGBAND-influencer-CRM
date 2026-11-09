# Google 주소 검색 통합 업데이트

검색 소스:
- Google Workspace Directory 사용자
- Google Contacts
- Other Contacts (Gmail/Google 상호작용으로 자동 저장된 주소)
- Google Groups 팀메일

## 추가 Vercel 환경변수
`GOOGLE_WORKSPACE_CUSTOMER_ID`

Google Admin Console에서 확인한 Customer ID를 넣으세요.
예: `C0123abcde`
앞의 C를 빼고 넣어도 코드가 자동으로 붙입니다.

## OAuth scopes
- https://www.googleapis.com/auth/contacts.readonly
- https://www.googleapis.com/auth/directory.readonly
- https://www.googleapis.com/auth/contacts.other.readonly
- https://www.googleapis.com/auth/cloud-identity.groups

scope 추가 후 Gmail을 다시 연결해 새 refresh token 권한을 받아야 합니다.
