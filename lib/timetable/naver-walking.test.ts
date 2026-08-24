import { describe, expect, it } from "vitest"
import {
  MAX_NAVER_WALKING_POINTS,
  buildNaverWalkingAndroidIntent,
  buildNaverWalkingScheme,
  buildNaverWalkingUrl,
  isNaverWalkingMobile,
  type NaverWalkingPoint,
} from "./naver-walking"

const start: NaverWalkingPoint = { lat: 35.8462, lng: 127.1294, name: "공과대학 8호관" }
const destination: NaverWalkingPoint = { lat: 35.8471, lng: 127.1282, name: "중앙도서관" }

function parseScheme(url: string): URLSearchParams {
  return new URLSearchParams(url.split("?")[1])
}

describe("NAVER walking deep links", () => {
  it("builds the official nmap walking scheme for a start and destination", () => {
    const url = buildNaverWalkingScheme([start, destination], "https://campus.example.com")

    expect(url).not.toBeNull()
    expect(url).toMatch(/^nmap:\/\/route\/walk\?/)

    const query = parseScheme(url!)
    expect(query.get("slat")).toBe(String(start.lat))
    expect(query.get("slng")).toBe(String(start.lng))
    expect(query.get("sname")).toBe(start.name)
    expect(query.get("dlat")).toBe(String(destination.lat))
    expect(query.get("dlng")).toBe(String(destination.lng))
    expect(query.get("dname")).toBe(destination.name)
    expect(query.get("appname")).toBe("https://campus.example.com")
  })

  it("maps up to five intermediate points to v1 through v5 parameters", () => {
    const waypoints = Array.from({ length: 5 }, (_, index) => ({
      lat: 35.8463 + index * 0.0001,
      lng: 127.1293 - index * 0.0001,
      name: `경유지 ${index + 1}`,
    }))
    const url = buildNaverWalkingScheme([start, ...waypoints, destination], "campus-app")
    const query = parseScheme(url!)

    expect(MAX_NAVER_WALKING_POINTS).toBe(7)
    for (let number = 1; number <= 5; number += 1) {
      expect(query.get(`v${number}lat`)).toBe(String(waypoints[number - 1].lat))
      expect(query.get(`v${number}lng`)).toBe(String(waypoints[number - 1].lng))
      expect(query.get(`v${number}name`)).toBe(waypoints[number - 1].name)
    }
  })

  it("builds the official Android intent with the NAVER Maps package", () => {
    const url = buildNaverWalkingAndroidIntent([start, destination], "campus-app")

    expect(url).toMatch(/^intent:\/\/route\/walk\?/)
    expect(url).toContain("#Intent;scheme=nmap;")
    expect(url).toContain("action=android.intent.action.VIEW;")
    expect(url).toContain("category=android.intent.category.BROWSABLE;")
    expect(url).toContain("package=com.nhn.android.nmap;end")
  })

  it("selects an intent on Android, a scheme on iOS, and no URL on desktop", () => {
    const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile"
    const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
    const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    expect(buildNaverWalkingUrl([start, destination], "campus-app", android)).toMatch(
      /^intent:\/\/route\/walk\?/,
    )
    expect(buildNaverWalkingUrl([start, destination], "campus-app", ios)).toMatch(
      /^nmap:\/\/route\/walk\?/,
    )
    expect(buildNaverWalkingUrl([start, destination], "campus-app", desktop)).toBeNull()
    expect(isNaverWalkingMobile(android)).toBe(true)
    expect(isNaverWalkingMobile(ios)).toBe(true)
    expect(isNaverWalkingMobile(desktop)).toBe(false)
  })

  it("rejects an invalid number of points, missing appname, and invalid coordinates", () => {
    const tooMany = Array.from({ length: 8 }, (_, index) => ({
      lat: 35 + index * 0.01,
      lng: 127,
      name: `지점 ${index}`,
    }))

    expect(buildNaverWalkingScheme([start], "campus-app")).toBeNull()
    expect(buildNaverWalkingScheme(tooMany, "campus-app")).toBeNull()
    expect(buildNaverWalkingScheme([start, destination], "   ")).toBeNull()
    expect(
      buildNaverWalkingScheme([{ ...start, lat: 91 }, destination], "campus-app"),
    ).toBeNull()
    expect(
      buildNaverWalkingScheme([{ ...start, lng: Number.NaN }, destination], "campus-app"),
    ).toBeNull()
    expect(
      buildNaverWalkingScheme([{ ...start, lat: 30 }, destination], "campus-app"),
    ).toBeNull()
    expect(
      buildNaverWalkingScheme([{ ...start, lng: 140 }, destination], "campus-app"),
    ).toBeNull()
    expect(
      buildNaverWalkingScheme([{ ...start, name: " " }, destination], "campus-app"),
    ).toBeNull()
  })
})
