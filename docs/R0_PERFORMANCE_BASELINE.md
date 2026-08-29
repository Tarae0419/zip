# R0 성능·비용 기준선

| 항목 | 내용 |
| --- | --- |
| 기준일 | 2026-08-28 |
| 기준 앱 코드 | `main@e9c1610` (이후 문서·측정 도구만 변경) |
| 실행 명령 | `pnpm build`, `pnpm quality:baseline -- --out docs/R0_PERFORMANCE_BASELINE.json` |
| 원시 결과 | `docs/R0_PERFORMANCE_BASELINE.json` |

## 현재 측정 가능 범위

| 지표 | 기준선 | 해석 |
| --- | ---: | --- |
| App Router 페이지 | 19개 | `app/**/page.tsx` 정적 집계 |
| Client Component | 30개 | 파일 선두의 `use client` 정적 집계 |
| Server Action 파일 | 10개 | 파일 선두의 `use server` 정적 집계 |
| localStorage 사용 파일 | 7개 | 마이그레이션 대상 탐색용 정적 집계 |
| DB 테이블 | 13개 | Drizzle `pgTable` 선언 집계 |
| 프로덕션 방출 JS | raw 1,053,033 bytes / gzip 332,314 bytes | 모든 방출 청크 합계이며 한 페이지 전송량이 아님 |
| 최대 방출 청크 | raw 227,527 bytes / gzip 71,003 bytes | 후속 번들 귀속 분석 대상 |

페이지별 초기 JS는 Next 프로덕션 build manifest의 공통 runtime과 각 route entry를 중복 제거한 뒤 계산한다.
현재 gzip 기준 상위 route는 다음과 같다.

| route | 초기 청크 | raw bytes | gzip bytes |
| --- | ---: | ---: | ---: |
| `/cart` | 14 | 759,516 | 228,209 |
| `/fields` | 12 | 708,905 | 213,270 |
| `/courses/[id]` | 12 | 708,150 | 212,762 |
| `/search` | 12 | 706,222 | 212,312 |
| `/curriculum` | 11 | 696,045 | 209,837 |

이 값은 브라우저 캐시, 압축 협상, RSC payload, 이미지·폰트·TMAP SDK를 포함한 실제 전송량이 아니다. 변경 전후 동일한
Next 버전·빌드 방식에서 회귀를 비교하는 기준으로만 사용한다.

## 아직 측정할 수 없는 운영 지표

다음 값은 계측이 없으므로 `0`으로 기록하지 않고 원시 결과에서 `status: unavailable`로 남긴다.

| 지표 | 현재 상태 | 다음 구현 |
| --- | --- | --- |
| 주요 사용자 여정 응답 시간 p50/p95 | 미계측 | 인증된 고정 여정과 프로덕션 Web Vital/서버 시간 export 연결 |
| 요청별 DB 쿼리 수·시간 | 미계측 | SQL·파라미터를 남기지 않는 Neon/Drizzle 요청 계수기 |
| AI 호출·실패·지연·토큰 | 미계측 | 프롬프트·응답을 남기지 않는 기능별 구조화 metric |
| TMAP 호출·캐시 적중·실패·일일 쿼터 | 미계측 | 키·좌표·geometry를 남기지 않는 서버 adapter metric |

Vercel Analytics 컴포넌트는 프로덕션 layout에 연결되어 있지만, 현재 로컬 환경에는 Vercel 운영 지표를 읽을 인증이
없어 14일 실사용 표본을 가져오지 못했다. 운영 export와 요청별 계측을 연결하기 전까지 R0의 성능·비용 기준선 항목은
부분 완료로 유지한다.

2026-08-29 재수집에서는 로컬 Vercel CLI 58.0.0까지 확인했으나 로그인 세션과 `VERCEL_TOKEN`이 없어서
`NOT_AUTH`로 중단됐다. 프로젝트에는 배포용 OIDC 값만 있으며 운영 지표 조회 토큰으로 대체하지 않는다.

## 측정 안전장치

- `.next/BUILD_ID`보다 앱·컴포넌트·라이브러리·빌드 설정이 최신이면 측정을 실패시키고 재빌드를 요구한다.
- route manifest는 JavaScript로 실행하지 않고 JSON 할당부만 파싱한다.
- 원시 결과에는 환경 변수, 사용자 데이터, SQL, AI 입력·출력, TMAP 키·좌표·geometry를 넣지 않는다.
- 방출 전체 크기와 route별 초기 JS를 분리해 전체 청크 합계를 사용자 전송량으로 오인하지 않는다.
