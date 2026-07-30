// 실제 캠퍼스 지도(카카오맵)에 쓸 건물 좌표를 한 번 조사해 lib/timetable/building-coordinates.json에 저장한다.
// courses.classroom 원문("전주:공과대학 8호관 402")에서 건물명만 추출해 카카오 로컬 API(키워드 검색)로
// 위경도를 찾는다 — 이 파일은 좌표를 DB가 아니라 정적 JSON으로 관리한다(건물 목록이 카탈로그 재import
// 때가 아니면 거의 안 바뀌는 참고 데이터라, classify-course-fields.ts류의 "결과 JSON을 사람이 검토" 패턴과
// 같은 이유). needsReview:true인 항목은 주소에 캠퍼스 지역명이 안 보여 자동 매칭을 확신할 수 없다는 뜻이니
// 커밋 전에 building-coordinates.json을 열어 좌표가 실제로 맞는지 눈으로 확인해야 한다.
// 실행: pnpm db:geocode-buildings
import { sql } from "drizzle-orm"
import { db } from "../client"
import { courses } from "../schema"
import { parseClassroom } from "../../timetable/schedule"
import { writeFileSync } from "node:fs"
import path from "node:path"

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY
const KNOWN_CAMPUSES = ["전주", "익산", "남원", "고창", "새만금"] as const
type Campus = (typeof KNOWN_CAMPUSES)[number]

// 검색 결과 주소에 이 지역명이 없으면 다른 지역의 동명 건물을 잘못 집었을 수 있다 — 검토 표시용.
const CAMPUS_CITY_HINT: Record<Campus, string> = {
  전주: "전주",
  익산: "익산",
  남원: "남원",
  고창: "고창",
  새만금: "부안", // 새만금 캠퍼스 부지는 행정구역상 부안군.
}

type GeocodeResult = {
  campus: Campus
  building: string
  lat: number
  lng: number
  matchedName: string
  address: string
  needsReview: boolean
}

async function searchKakao(query: string): Promise<{ x: string; y: string; place_name: string; address_name: string }[]> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } })
  if (!res.ok) throw new Error(`카카오 로컬 API 오류 (${res.status}): ${await res.text()}`)
  const json = (await res.json()) as { documents: { x: string; y: string; place_name: string; address_name: string }[] }
  return json.documents
}

async function geocodeBuilding(campus: Campus, building: string): Promise<GeocodeResult | null> {
  const cityHint = CAMPUS_CITY_HINT[campus]
  const docs = await searchKakao(`전북대학교 ${cityHint} ${building}`)
  const best = docs[0] ?? (await searchKakao(`전북대학교 ${building}`))[0]
  if (!best) return null

  return {
    campus,
    building,
    lat: Number(best.y),
    lng: Number(best.x),
    matchedName: best.place_name,
    address: best.address_name,
    needsReview: !best.address_name.includes(cityHint),
  }
}

async function main() {
  if (!KAKAO_REST_API_KEY) {
    console.error("KAKAO_REST_API_KEY가 .env.local에 없어요.")
    process.exit(1)
  }

  const rows = await db.selectDistinct({ classroom: courses.classroom }).from(courses).where(sql`${courses.classroom} is not null`)

  const seen = new Set<string>()
  const targets: { campus: Campus; building: string }[] = []
  for (const r of rows) {
    const loc = parseClassroom(r.classroom)
    if (!loc) continue
    if (!(KNOWN_CAMPUSES as readonly string[]).includes(loc.campus)) continue // 강의실 원문이 깨진 소수 row는 제외
    const key = `${loc.campus}|${loc.building}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push({ campus: loc.campus as Campus, building: loc.building })
  }

  console.log(`고유 건물 ${targets.length}개 조회 시작`)

  const results: GeocodeResult[] = []
  const failed: { campus: Campus; building: string }[] = []

  for (const target of targets) {
    try {
      const result = await geocodeBuilding(target.campus, target.building)
      if (result) {
        results.push(result)
        console.log(`${result.needsReview ? "⚠ " : "✓ "}${target.campus} ${target.building} → (${result.lat}, ${result.lng}) [${result.matchedName}]`)
      } else {
        failed.push(target)
        console.log(`✗ ${target.campus} ${target.building} — 검색 결과 없음`)
      }
    } catch (err) {
      failed.push(target)
      console.error(`✗ ${target.campus} ${target.building} — 오류:`, err)
    }
    await new Promise((r) => setTimeout(r, 120)) // 카카오 API에 예의상 약간의 텀
  }

  const outPath = path.join(__dirname, "../../timetable/building-coordinates.json")
  writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n", "utf-8")

  console.log(`\n완료: ${results.length}개 저장 (${outPath}), 실패 ${failed.length}개`)
  if (failed.length > 0) console.log("실패 목록:", failed)
  const reviewCount = results.filter((r) => r.needsReview).length
  if (reviewCount > 0) console.log(`⚠ ${reviewCount}개는 needsReview:true — 커밋 전에 좌표가 맞는지 확인해주세요.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
