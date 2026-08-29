# R0 PRD2 현행 구현 감사

| 항목 | 내용 |
| --- | --- |
| 기준일 | 2026-08-28 |
| 비교 기준 | docs/PRD_V2.md |
| 목적 | 코드 존재와 PRD2 완료를 분리하고 재작업 범위 확정 |
| 판정 | 기존 완료 승계 없음 |

## 1. 기능별 판정

| 기능 | 현재 구현 | PRD2 판정 | 핵심 근거 | 재작업 |
| --- | --- | --- | --- | --- |
| F1 수강평·AI 요약 | DB 리뷰, 해시태그 제안, 5개 이상 요약, 삭제 | PRD2 재설계 필요 | lib/actions/reviews.ts, lib/ai/summary.ts, summaries 스키마 | R3, R10 |
| F2 학문 분야 검색 | 과목명/분야 결과와 태그 분류 | PRD2 재검증 필요 | components/search-results.tsx, lib/db/queries.ts | R3 |
| F3 산업·진로 검색 | 11개 분야, pgvector 관련도 | PRD2 재설계 필요 | app/fields, course_industry_tags, 오프라인 분류 스크립트 | R3, R8, R14 |
| F4 커리큘럼 | 2개 학과 계획, 결정론 로직과 AI 이유, 편집 | PRD2 재설계 필요 | lib/actions/curriculum.ts, components/curriculum-planner.tsx | R5 |
| F5 시간표·이동동선 | 계정 장바구니, 시간표, TMAP 서버 실경로·거리·시간, 부분 실패, 추정 상태 | R0 선구현·수동 검증 필요 | app/api/tmap/walking, tmap-route-experience.tsx, campus-map.tsx | R6, R7 |
| F6 수강 추세 | 동일 학수번호의 공개 수강 인원 합산·차트·규칙 요약 | 부분 구현 | lib/enrollment/trend.ts, getCourseEnrollmentTrend | R10 |
| F7 역량 로드맵 | AI 활동, 폴백, 이유·확신, 편집 | 부분 구현 | capability-activities.ts, curriculum-planner.tsx | R8 |
| F8 포트폴리오 | localStorage CRUD와 커리큘럼 활동 가져오기 | 로컬 시제품 | components/portfolio-builder.tsx, lib/portfolio/storage.ts | R12 |
| F9 자격증·교육 | 일반 활동 문구 외 원장·화면 없음 | 미지원 | 관련 DB 엔티티·route 없음 | R14 |
| F10 수업 허브 | localStorage 기록, AI 요약·면접 질문 | 로컬 시제품 | components/study-hub.tsx, lib/actions/study.ts | R11 |
| F11 교재 가이드 | 엔티티·화면 없음 | 미지원 | syllabusUrl 실데이터 비어 있음 | R16 조건부 |
| F12 이수체계·선수 | curricula와 과목별 선수 코드 배열, 관리자 편집 | 데이터 모델 시제품 | schema.ts, seed-curricula.ts, prerequisites-editor.tsx | R4 |
| F13 공지·채용·알림 | 설계 문서만 존재 | 미지원 | NOTICE_COLLECTION_DESIGN.md, DB·route 없음 | R13, R14 |
| F14 취업 사례·자소서 | 엔티티·화면·권한 원장 없음 | 미지원 | 관련 구현 없음 | R17 조건부 |
| F15 선호 시간표 | 현재 장바구니 과목의 분반 조합과 선호 점수 | 부분 구현 | lib/timetable/preferences.ts, schedule-preferences.ts | R6 |
| F16 품질 피드백 | 커리큘럼 만족도 3항목 localStorage | 로컬 데모 | curriculum-planner.tsx | R9 |

### 1.1 사용자 여정·데이터·액션·관리자 경로 매트릭스

정적 감사 기준은 `main@e9c1610`이다. 이 표의 완료는 코드 경로를 분류했다는 뜻이며, 실데이터 범위·권한·브라우저
E2E·외부 응답·현장 검수는 각 R0 게이트와 기능 스프린트에서 별도로 검증한다.

| 기능·분류 | 사용자 여정·route | 읽기 흐름 | 쓰기·서버 액션 | 저장소·외부 | 관리자 경로 | PRD2 핵심 간극 |
| --- | --- | --- | --- | --- | --- | --- |
| F1 재설계 | `/courses/[id]`에서 요약·리뷰 확인 → 태그 제안 → 등록·삭제 | 과목·동일 학수번호 리뷰·요약 조회 | `submitReview`, `suggestReviewHashtags`, `deleteReview` | `courses`, `reviews`, `summaries`; OpenAI | `/admin/reviews`, `/admin/courses/[id]` | 삭제 후 stale 처리와 AI 입력·모델·근거 버전 없음 |
| F2 재검증 | `/search?q=&tab=name\|field`에서 과목명·학문 분야 탐색 | `searchCoursesByName`, `searchCoursesByFieldTag` | 사용자 쓰기 없음 | `field_tags`, `course_field_tags`, `courses` | `/admin/courses/[id]` 분야 태그 편집 | URL 상태·동의어 품질·전 학과 성능·F4 전달 재검증 |
| F3 재설계 | `/fields`에서 산업 분야 선택 → 관련도순 과목 확인 | `getIndustryFields`, `getIndustryFieldCourses` | 오프라인 분류·임베딩 스크립트 | `industry_tags`, `course_industry_tags`, `course_embeddings`; OpenAI | `/admin/courses/[id]` 산업 태그 편집 | 분류·임베딩·검수 버전과 공통 관심 분야 원장 없음 |
| F4 재설계 | `/curriculum` 입력 → 계획 생성 → 편집·제외 | 사용자·교육과정·과목 조회 후 결정론 배치 | `generateCurriculumPlan` | `users`, `curricula`, `courses`; OpenAI; `curriculum-plan-v2` localStorage | `/admin/curricula*`, `/admin/courses/[id]` | 계획 DB·입학연도 선택·버전·복원·서버 재검증 없음 |
| F5 재검증 | 과목 상세/`/cart` 담기 → 시간표 → 요일별 TMAP 지도·구간 시간 | 장바구니·과목·건물 allowlist 조회 | `getCartItems`, `addCartItem`, `removeCartItem`; `POST /api/tmap/walking` | `cart_items`, `courses`; TMAP REST·Vector JS; 23시간 메모리 캐시 | 전용 관리 없음, 과목 공개 여부만 간접 관리 | 출입구 현장 검수·일일 쿼터 계측·F15 확정 계약 필요 |
| F6 재설계 | `/courses/[id]`에서 학기별 수강 추세 확인 | `getCourseEnrollmentTrend`와 규칙 기반 `summarizeEnrollmentTrend` | 쓰기·전용 action 없음 | 현재 `courses.enrolledCount/capacity` | 전용 관리 없음 | snapshot·결측/0·부분 분반·계보·출처 없음 |
| F7 재설계 | `/curriculum`에서 학년별 역량 활동 생성·편집 | F4 결과와 사용자 키워드 사용 | F4 action 내부 `generateCapabilityActivities` | OpenAI 또는 규칙 폴백; F4 localStorage에 포함 | 전용 관리 없음 | 공식 근거·계정 버전·F4 과목 순위 연결 없음 |
| F8 재설계 | `/portfolio`에서 항목 CRUD·커리큘럼 활동 가져오기 | `curriculum-plan-v2`, `portfolio-v1` 읽기 | 브라우저 로컬 CRUD | localStorage만 사용 | 없음 | 계정 소유권·원본 ID·버전·충돌·휴지통·내보내기 없음 |
| F9 미지원 | 사용자 route 없음 | 없음 | 없음 | 원장·스키마 없음 | 없음 | 포트폴리오의 자격증 분류는 공식 원장·추천 기능이 아님 |
| F10 재설계 | `/study`에서 장바구니 과목 선택 → 기록 → 요약·질문 | DB 장바구니와 `study-hub-v1` 읽기 | `generateStudyInsights`; 브라우저 기록 CRUD | `cart_items`, OpenAI, localStorage | 없음 | StudyRecord DB·80자 근거 서버 검증·원본/수정본·복원 없음 |
| F11 미지원 | 사용자 route 없음 | 없음 | 없음 | nullable `courses.syllabusUrl`만 존재 | 없음 | 허용 교재·강의계획서 원장·실데이터·화면 없음 |
| F12 재설계 | `/curriculum`에서 최신 curriculum·선수코드 기반 배치 | `curricula.requiredCourseCodes`, `courses.prerequisiteCodes` | F4 action에서 사용 | `curricula`, `courses` | `/admin/curricula*`, `/admin/courses/[id]` | 관계형 선수·동시·택일·예외·출처·적용기간·순환검사 없음 |
| F13 미지원 | 사용자 route 없음 | 없음 | 없음 | 설계 문서만 존재 | 없음 | 승인된 공지·채용 수집기·상태·알림 원장 없음 |
| F14 미지원 | 사용자 route 없음 | 없음 | 없음 | 스키마·권한 원장 없음 | 없음 | 허용 취업 사례·비식별화·철회 흐름 없음 |
| F15 재설계 | `/cart` 선호 입력 → 후보 비교 → 적용 | 현재 장바구니 과목의 동일 과목 분반 조회 | `createPreferredScheduleCandidates`, `applyPreferredScheduleCandidate` | `cart_items`, `courses`, `users`; 적용 시 transaction | 없음 | 남은 필수 자동 산출·후보/확정 엔티티·탐색 상한·전체 하드 재검증 없음 |
| F16 재설계 | `/curriculum`에서 3개 만족도 점수 저장 | `curriculum-feedback-v2` 읽기 | 브라우저 단건 저장 | localStorage만 사용 | 없음 | 최신성 포함 4항목·대상 버전·정정 상태·운영 집계 없음 |

관리자 공통 route는 `/admin`, `/admin/reviews`, `/admin/courses`, `/admin/courses/[id]`,
`/admin/curricula`, `/admin/curricula/new`, `/admin/curricula/[id]`, `/admin/users`다. 현재 관리자 mutation은
`requireAdmin()`을 호출하지만 출처·AI 이력·건물 좌표·피드백·공지/채용·자격증·콘텐츠 권한을 관리하는 경로는 없다.

## 2. 즉시 해결해야 할 신뢰성 문제

### 인증·권한

- lib/auth/session.ts는 users.anonId 자체를 최대 2년 쿠키로 사용한다.
- 로그아웃은 브라우저 쿠키만 삭제하며 서버 폐기·회전·세션 목록이 없다.
- proxy.ts는 쿠키 존재만 확인한다. 서버 액션은 공개 엔드포인트와 같은 수준으로 각 액션 내부 권한 검사가 필요하다.
- 회원가입 OTP는 Math.random 기반이며 평문 저장, 요청 rate limit, 검증 시도 제한이 없다.
- 사용자 산출물의 DB 이전보다 R1 세션 보강이 먼저다.

### 학사 규칙·시간표

- 공식 선수 데이터가 아닌 seed-curricula.ts의 예시 관계가 courses.prerequisiteCodes에 들어간다.
- getCurriculumForDepartment는 사용자 입학연도 대신 최신 curriculum 한 건을 선택한다.
- F15는 남은 필수과목을 산출하지 않고 현재 장바구니 과목의 분반만 바꾼다.
- 일부 validationIssues가 있는 후보도 반환되고, 적용 액션은 전체 하드 제약을 다시 계산하지 않는다.
- 탐색 상한과 최적성 미보장 상태가 사용자에게 보이지 않는다.

### AI·출처

- 리뷰 제출 요청 안에서 AI 요약 재생성이 동기 실행되어 사용자 저장 지연과 외부 실패가 결합된다.
- 리뷰 삭제 후 요약을 stale 처리하거나 재생성하지 않아 삭제된 내용이 남을 수 있다.
- summaries에는 모델·프롬프트·입력 해시·근거 ID·검증 상태가 없다.
- F7 자유 키워드는 활동 생성에는 쓰이지만 F4 과목 후보·순위에는 직접 반영되지 않는다.
- OpenAI 키가 없으면 공용 client 모듈 import 시 예외가 발생해 선택 기능의 graceful degradation이 어렵다.

### 브라우저 저장

- curriculum-plan, portfolio, study-hub, 만족도가 localStorage에 남는다.
- 포트폴리오와 수업 허브는 입력할 때 전체 JSON을 동기 직렬화한다.
- 계정 동기화, 버전, 충돌, 30일 휴지통, 복원, 운영 집계가 없다.
- localStorage 데이터는 R1 이후 일회성 가져오기·중복 방지·롤백을 거쳐 서버로 이전해야 한다.

### 수강 추세

- 결측 학기를 제거해 데이터 없음과 실제 0을 구분할 수 없다.
- 일부 분반의 수강 인원이 없을 때 부분 합계를 완전한 학기 합계처럼 볼 수 있다.
- 과목 코드 계보, 교차개설 중복, 충원율, 전년 동기, 원본·갱신일이 없다.
- AI 숫자 검증 이전에는 규칙 문장만 공식 통계 설명으로 사용할 수 있다.

## 3. 성능·구조 기준선

- app/page.tsx는 사용자 학과와 인기 과목을 직렬 조회하고 AppHeader가 사용자 이름을 별도 조회한다.
- RootLayout의 CartProvider가 로그인·공개 페이지를 포함한 전체 앱에서 장바구니 서버 액션을 호출한다.
- app/fields/page.tsx는 분야마다 과목 쿼리를 반복하며 각 쿼리에서 리뷰 통계를 다시 읽는다.
- 검색은 현재 탭과 무관하게 과목명·분야 결과를 함께 불러오고, 고정 limit 60 이후 클라이언트 정렬을 사용한다.
- components/curriculum-planner.tsx, cart-timetable-view.tsx, campus-map.tsx와 lib/db/queries.ts는 책임 분리가 필요한 대형 파일이다.
- TMAP Vector SDK는 별도 클라이언트 경계에서 조건부 동적 로딩하도록 분리했고 Kakao/NAVER 런타임·외부 앱 폴백을 제거했다. R7에서는 공개 지도 키와 실패 상태를 실제 기기에서 수용 검증한다.

빌드·route별 JS 실측과 미계측 운영 지표는 `docs/R0_PERFORMANCE_BASELINE.md`에서 관리한다. 키보드·포커스·모달·
스크린리더·reduced motion·모바일 긴 텍스트의 재현 및 우선 수정 결과는 `docs/R0_ACCESSIBILITY_AUDIT.md`에서 관리한다.

## 4. 현재 데이터 흐름

### 서버 데이터

1. proxy.ts가 sgz_anon_id 쿠키 존재를 확인한다.
2. Server Component와 AppHeader·CartProvider가 getAnonId와 사용자 쿼리를 각각 호출한다.
3. lib/db/queries.ts의 DB 쿼리와 일부 unstable_cache 결과가 화면에 전달된다.
4. Server Action이 리뷰·장바구니·커리큘럼·관리자 변경을 수행한다.
5. 일부 Server Action은 같은 요청 안에서 OpenAI를 호출한다.

### 사용자 산출물

1. 커리큘럼 결과 일부, 수업 기록, 포트폴리오, 만족도가 브라우저 localStorage에 저장된다.
2. 장바구니만 cart_items로 계정 저장된다.
3. 브라우저 저장과 DB 사이의 공통 버전·충돌·삭제·내보내기 정책은 없다.

### 외부·오프라인 데이터

1. course XLSX를 import 스크립트로 courses에 적재한다.
2. 분야·산업 분류는 OpenAI/embedding 오프라인 스크립트와 검수 JSON을 거친다.
3. 공지·자격증·채용·교재·취업 사례 수집 계층은 아직 없다.

## 5. R0 이후 우선순위

1. R1: 세션 해시·만료·폐기·회전, OTP 제한, 모든 액션 소유권
2. R2: 사실·출처·AI 이력과 점진 마이그레이션 기반
3. R3: F1~F3의 쿼리·AI·검색 상태 재최적화
4. R4~R7: 공식 규칙 → 커리큘럼 → 시간표 → 실제 도보 경로
5. R8 이후: 사용자 산출물·외부 콘텐츠를 검증된 기반 위에 연결

기존 기능은 이 문서의 주 재작업 스프린트와 R15 전수 회귀를 모두 통과하기 전 PRD2 완료로 표시하지 않는다.
