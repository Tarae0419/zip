# R0 PRD2 현행 구현 감사

| 항목 | 내용 |
| --- | --- |
| 기준일 | 2026-08-27 |
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

세부 file:line 감사와 접근성 목록은 docs/R0_UI_PERFORMANCE_AUDIT.md에서 관리한다.

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
