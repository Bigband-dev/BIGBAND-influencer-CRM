# Influencer CRM

사내 인플루언서 데이터베이스 및 캠페인 운영을 위한 내부 관리 웹 애플리케이션입니다.

## 프로젝트 목적

기존에 Excel, 개별 문서, 메신저 등으로 분산되어 관리되던 인플루언서 정보를 하나의 DB로 통합하고,
캠페인별 제안/협업 이력을 팀 단위로 공유할 수 있도록 만드는 것을 목표로 합니다.

주요 사용자는 마케팅/AE 실무자이며, 별도의 개발 지식 없이도 인플루언서 검색, 등록, 수정,
캠페인 관리 및 협업 이력 확인이 가능하도록 설계합니다.

## 주요 기능

### 인플루언서 DB
- 인플루언서 목록 조회
- 이름 / Instagram ID / 카테고리 기반 검색
- 팔로워, 평균 조회수, 협업 단가 등 주요 정보 관리
- 신규 인플루언서 등록
- 기존 인플루언서 수정 및 삭제
- 인플루언서 상세 정보 확인
- 캠페인 참여/제안 이력 확인

### Excel Import
- 기존 Excel 인플루언서 리스트 업로드
- 컬럼 자동 매핑 및 사용자 수정
- Instagram ID 기준 데이터 추가/업데이트
- `만`, `천`, `k`, `m` 등 숫자 단위 정규화
- DB 저장 전 미리보기 제공

### 캠페인 관리
- 전체 캠페인 목록 조회
- 캠페인명 / 광고주 / 제품명 검색
- 준비 중 / 진행 중 / 완료 / 취소 등 상태별 필터
- 신규 캠페인 생성
- 캠페인별 인플루언서 연결
- 인플루언서별 캠페인 진행 이력 연동

### 사용자 및 권한 관리
현재 기본 사용자 인증은 Supabase Auth를 사용합니다.

향후 권한 구조는 다음과 같이 확장할 수 있습니다.

- `owner`: 최초 시스템 관리자 및 최고 권한
- `admin`: 운영 관리자
- `member`: 일반 팀원

운영 담당자가 변경되더라도 여러 명의 Admin을 지정하여 시스템을 지속적으로 운영할 수 있도록 하는 것을 목표로 합니다.

## 기술 스택

- **Frontend:** Next.js
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend / Database:** Supabase
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth
- **Deployment:** Vercel
- **Version Control:** Git / GitHub

## 주요 데이터 구조

### influencers
인플루언서 기본 정보를 저장합니다.

주요 필드:
- name
- instagram_id
- instagram_url
- email
- phone
- followers
- avg_views
- category
- subcategory
- gender
- age_group
- collaboration_rate
- memo

### campaigns
캠페인 기본 정보를 저장합니다.

주요 필드:
- name
- brand
- product
- description
- start_date
- end_date
- status

### campaign_influencers
캠페인과 인플루언서를 연결하는 관계 테이블입니다.

주요 필드:
- campaign_id
- influencer_id
- status
- proposed_rate
- final_rate
- memo

하나의 인플루언서가 여러 캠페인에 참여할 수 있고,
하나의 캠페인에 여러 인플루언서를 연결할 수 있도록 구성되어 있습니다.

## 프로젝트 구조 예시

```text
app/
├─ page.tsx
├─ login/
├─ signup/
└─ (crm)/
   ├─ layout.tsx
   ├─ influencers/
   └─ campaigns/

components/
├─ sidebar.tsx
├─ influencer-table.tsx
├─ influencer-form.tsx
├─ excel-import.tsx
├─ campaign-table.tsx
├─ campaign-form.tsx
└─ campaign-influencer-manager.tsx

lib/
├─ supabase/
└─ format-number.ts
```

## 로컬 실행

```bash
npm install
npm run dev
```

기본 개발 주소:

```text
http://localhost:3000
```

## 환경 변수

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 값을 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Secret Key / Service Role Key는 클라이언트 코드에 노출하지 않습니다.

## 배포

Vercel과 GitHub Repository를 연결하여 배포합니다.

Vercel 프로젝트에도 다음 환경 변수를 등록해야 합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## 데이터 표기 규칙

### 팔로워 / 평균 조회수
DB에는 실제 숫자를 저장합니다.

예:
- `190000` → 화면에서 `19만`
- `32500` → 화면에서 `3.25만`

### 협업 단가
현재 DB의 `collaboration_rate`는 **만원 단위**로 저장합니다.

예:
- `30` → `30만원`
- `150` → `150만원`

## 향후 개발 예정

- 캠페인 상세 페이지 고도화
- 인플루언서 캠페인 진행 상태 변경
- 제안 단가 / 최종 단가 관리
- 캠페인별 메모 및 히스토리
- Owner / Admin / Member 권한 관리
- 사용자 관리 화면
- 인플루언서 서칭 기능 연동
- Google Workspace / Shared Drive 연동 검토
- 변경 이력 및 삭제 복구 기능

## 최초 개발 및 기여

본 시스템의 초기 아키텍처 설계, 데이터베이스 구조 설계 및 웹 애플리케이션 구현은 아래 개발자가 수행했습니다.

- **Initial System Architecture & Implementation:** [최승환 (425range)]
- **Original Role:** Account Executive (AE) / Internal Tool Developer
- **Initial Development:** 2026
- **Initial Repository:** Personal GitHub repository

본 항목은 프로젝트의 최초 개발 및 기술적 기여 이력을 기록하기 위한 것입니다.

회사 내부 운영을 위한 소프트웨어 사용 권한 및 지식재산권의 구체적인 범위는 회사와 개발자 간 별도 합의,
근로계약, 사규 및 관련 법령에 따릅니다.

## 보안 주의사항

- `.env.local`은 GitHub에 커밋하지 않습니다.
- Supabase Secret / Service Role Key를 프론트엔드에 포함하지 않습니다.
- DB 테이블은 Row Level Security(RLS)를 사용합니다.
- 실제 운영 전 사용자 가입 도메인 제한을 서버/DB 레벨에서도 적용하는 것을 권장합니다.
- 개인정보 및 인플루언서 연락처 데이터에 대한 접근 권한을 최소화합니다.

## License / Internal Use

현재 프로젝트는 사내 업무용 시스템으로 개발 중입니다.

외부 배포, 소스코드 재사용, 제3자 제공 및 상업적 이용에 관한 권한은
회사와 최초 개발자 간의 별도 합의 또는 적용되는 계약/정책에 따라 결정합니다.
