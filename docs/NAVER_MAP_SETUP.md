# NAVER 지도·도보 길찾기 설정

> F5의 기본 경로 화면은 TMAP Vector JS와 보행 REST API로 전환한다. 이 문서는 TMAP 실패 시 사용하는
> NAVER 지도 앱 도보 길찾기와 기존 지도 핀 폴백 설정만 다룬다. 기준 요구사항은 `docs/PRD_V2.md`의 F5다.

## 적용 구조

- 웹 지도: NAVER Dynamic Map에 시간표 순서별 건물 핀을 표시한다.
- 실제 도보 경로: 모바일에서 NAVER 지도 앱의 공식 `route/walk` URL Scheme을 연다.
- 이동시간: NAVER의 공개 Directions API가 자동차 전용이므로 웹 화면에서는 기존 직선거리 추정치로 표시한다.
- 키가 없을 때: 기존 카카오 지도 또는 스케매틱 지도로 폴백하지만 모바일 도보 길찾기 링크는 계속 동작한다.

## NAVER Cloud 설정

1. NAVER Cloud Platform의 `Application Services > Maps`에서 새 Maps 애플리케이션을 만든다.
2. 사용할 API에서 `Dynamic Map`을 활성화한다.
3. Web 서비스 URL에 로컬 개발 주소 `http://localhost:3000`을 등록한다.
4. 발급된 Client ID를 `.env.local`에 설정한다.

```dotenv
NEXT_PUBLIC_NAVER_MAP_KEY_ID=발급받은_Client_ID
```

`NEXT_PUBLIC_` 값은 브라우저에 공개된다. 여기에는 Client ID만 넣고 Client Secret 또는 REST API Key는 넣지 않는다.
환경 변수를 바꾼 뒤 개발 서버를 다시 시작해야 한다.

## 검증 체크리스트

- 시간표의 `이동동선`에서 네이버 지도와 순서 핀이 보인다.
- 지도에 실제 길로 오인할 직선 폴리라인이 보이지 않는다.
- Android에서 `실제 도보 길찾기`가 NAVER 지도 앱의 보행 경로로 열린다.
- iOS에서 NAVER 지도 앱 설치 상태의 Scheme 실행을 확인한다.
- 하루 동선의 출발지·최대 5개 경유지·목적지가 수업 순서와 일치한다.
- 좌표가 없거나 다른 캠퍼스인 구간에는 잘못된 길찾기 링크가 생기지 않는다.

## 사용 제한

- [NAVER Directions 5](https://api.ncloud-docs.com/docs/application-maps-directions5)는 자동차 경로 전용이다.
  자동차 ETA나 경로선을 도보 정보로 표시하지 않는다.
- [NAVER 지도 앱 URL Scheme](https://guide.ncloud-docs.com/docs/en/application-maps-url-scheme-vpc)은 모바일 앱
  연결 방식이며 경로 결과를 웹앱에 반환하지 않는다.
- 웹 화면 안에서 실제 도보 경로선·거리·시간이 필요하면 NAVER 지도와 섞어 표시하기 전에 별도 보행 API의
  라이선스와 지도 표시 조건을 확인한다.
- 건물 좌표 원장은 학교 공식 시설 데이터, 공공데이터 또는 직접 검수한 출입구 좌표로 관리하고 출처와
  검수일을 남긴다.

## 공식 문서

- [Dynamic Map JavaScript 인증](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)
- [신규 Maps API 개요](https://api.ncloud-docs.com/docs/en/application-maps-overview)
- [Maps 애플리케이션 등록](https://guide.ncloud-docs.com/docs/en/application-maps-app-vpc)
- [도보 길찾기 URL Scheme](https://guide.ncloud-docs.com/docs/en/application-maps-url-scheme-vpc)
