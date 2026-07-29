---
name: neon-branch-preview-sync
description: Vercel 프리뷰 배포마다 격리된 Neon Postgres DB 브랜치를 자동 생성·연결하는 워크플로우. "프리뷰 배포에서 DB 브랜치 확인/생성", "Neon Vercel 연동 설정", "프리뷰 환경에서 마이그레이션 검증"을 요청받았을 때 사용한다.
metadata:
  author: project
  version: "1.0.0"
---

# Neon Branch × Vercel Preview 연동

수강길잡이 PRD 10.4는 "Vercel 프리뷰 배포와 Neon 브랜칭을 연동하면 기능 단위 배포마다 격리된 DB 브랜치가 자동 생성되어, 배포 전 분야 태깅·커리큘럼 로직 변경을 안전하게 검증할 수 있다"고 명시한다. 이 스킬은 그 워크플로우를 설정·검증하는 절차를 담는다.

## 전제 조건 확인

```bash
# Vercel 프로젝트 연결 여부
cat .vercel/project.json 2>/dev/null || echo "not linked"

# Neon 연동(Vercel Integration) 존재 여부는 Vercel 대시보드/CLI로 확인
vercel env ls 2>/dev/null
```

`DATABASE_URL` 계열 환경변수가 Preview 환경에도 별도로 존재하는지 먼저 확인한다. Production과 동일한 값이면 아직 브랜치 연동이 안 된 상태다.

## 설정 절차 (Neon Vercel-Native Integration 사용)

1. Vercel 대시보드 → 해당 프로젝트 → Integrations(Marketplace) → **Neon** 추가 (아직 연동 안 됐다면 사용자에게 대시보드에서 직접 설치하도록 안내한다 — 이 단계는 웹 UI 작업이라 CLI로 대신할 수 없다).
2. 연동 시 "Create a branch for each preview deployment" 옵션을 활성화한다. 이 옵션이 켜지면 PR/브랜치별 프리뷰 배포마다 Neon 브랜치가 자동 생성되고, 해당 브랜치의 연결 문자열이 Preview 환경변수(`DATABASE_URL` 등)로 자동 주입된다.
3. 브랜치 생성 시 부모 브랜치(보통 `main`/`production`)의 스키마와 데이터를 그대로 복사(copy-on-write)하므로, 실제 운영 데이터 규모로 마이그레이션·분야 태깅 로직을 검증할 수 있다.

## 마이그레이션 검증 워크플로우

1. 기능 브랜치에서 스키마 변경(마이그레이션 파일)을 작성한다 — `neon-db` 에이전트 참고.
2. 브랜치를 push해 프리뷰 배포를 트리거한다(`deploy-to-vercel` 스킬 참고).
3. 프리뷰 배포 빌드 로그 또는 배포 후 실행되는 마이그레이션 스텝에서 해당 프리뷰 전용 Neon 브랜치에 마이그레이션이 적용됐는지 확인한다:
   ```bash
   vercel inspect <preview-deployment-url>
   ```
4. 프리뷰 URL에서 실제로 F2(분야 통합검색)·F3(산업분야 검색)·F4(커리큘럼 추천) 등 스키마 변경의 영향을 받는 기능을 직접 확인한다.
5. 문제가 없으면 main으로 머지 → 프로덕션 배포 시 프로덕션 Neon 브랜치에 동일 마이그레이션을 적용한다(수동 확인 후 진행, 자동 실행 금지).

## 주의사항

- 프리뷰 브랜치는 매 배포마다 새로 생기거나 재사용될 수 있어 브랜치 안에서 수행한 수동 데이터 변경은 다음 배포에서 사라질 수 있다. 영속시켜야 할 시드 데이터는 마이그레이션/시드 스크립트로 관리한다(F4 더미 커리큘럼 데이터 등, PRD 8.4 참고).
- 브랜치 자동 생성/삭제는 Neon 프로젝트의 브랜치 개수·컴퓨트 사용량에 영향을 준다 — 오래된 프리뷰 브랜치 정리 정책을 Neon 대시보드에서 함께 확인한다.
- 연동 설정 자체(Marketplace 설치, 옵션 토글)는 사용자 계정 권한이 필요한 웹 UI 작업이므로 CLI로 대신 실행하지 말고, 정확한 절차만 안내한다.
