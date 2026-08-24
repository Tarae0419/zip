export const MAX_NAVER_WALKING_WAYPOINTS = 5
export const MAX_NAVER_WALKING_POINTS = MAX_NAVER_WALKING_WAYPOINTS + 2

const NAVER_MAP_BOUNDS = {
  minLat: 31.43,
  maxLat: 44.35,
  minLng: 122.37,
  maxLng: 132,
} as const

export type NaverWalkingPoint = {
  lat: number
  lng: number
  name: string
}

type NaverWalkingPlatform = "android" | "ios" | "desktop"

function getNaverWalkingPlatform(userAgent: string): NaverWalkingPlatform {
  if (/android/i.test(userAgent)) return "android"
  if (/(iphone|ipad|ipod)/i.test(userAgent)) return "ios"
  return "desktop"
}

function isValidPoint(point: NaverWalkingPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    point.lat >= NAVER_MAP_BOUNDS.minLat &&
    point.lat <= NAVER_MAP_BOUNDS.maxLat &&
    Number.isFinite(point.lng) &&
    point.lng >= NAVER_MAP_BOUNDS.minLng &&
    point.lng <= NAVER_MAP_BOUNDS.maxLng &&
    point.name.trim().length > 0
  )
}

function buildWalkingQuery(points: NaverWalkingPoint[], appName: string): string | null {
  const normalizedAppName = appName.trim()
  if (
    points.length < 2 ||
    points.length > MAX_NAVER_WALKING_POINTS ||
    normalizedAppName.length === 0 ||
    !points.every(isValidPoint)
  ) {
    return null
  }

  const start = points[0]
  const destination = points.at(-1)!
  const query = new URLSearchParams({
    slat: String(start.lat),
    slng: String(start.lng),
    sname: start.name.trim(),
  })

  points.slice(1, -1).forEach((point, index) => {
    const waypointNumber = index + 1
    query.set(`v${waypointNumber}lat`, String(point.lat))
    query.set(`v${waypointNumber}lng`, String(point.lng))
    query.set(`v${waypointNumber}name`, point.name.trim())
  })

  query.set("dlat", String(destination.lat))
  query.set("dlng", String(destination.lng))
  query.set("dname", destination.name.trim())
  query.set("appname", normalizedAppName)

  return query.toString()
}

export function isNaverWalkingMobile(userAgent: string): boolean {
  return getNaverWalkingPlatform(userAgent) !== "desktop"
}

export function buildNaverWalkingScheme(points: NaverWalkingPoint[], appName: string): string | null {
  const query = buildWalkingQuery(points, appName)
  return query ? `nmap://route/walk?${query}` : null
}

export function buildNaverWalkingAndroidIntent(
  points: NaverWalkingPoint[],
  appName: string,
): string | null {
  const query = buildWalkingQuery(points, appName)
  if (!query) return null

  return `intent://route/walk?${query}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`
}

export function buildNaverWalkingUrl(
  points: NaverWalkingPoint[],
  appName: string,
  userAgent: string,
): string | null {
  const platform = getNaverWalkingPlatform(userAgent)
  if (platform === "android") return buildNaverWalkingAndroidIntent(points, appName)
  if (platform === "ios") return buildNaverWalkingScheme(points, appName)
  return null
}
