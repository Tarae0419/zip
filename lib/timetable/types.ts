// 강의실 이동동선 지도 기능(F5 성격, PRD 범위 밖)에서 쓰는 타입.
// 화면은 이 타입에만 의존한다. lib/actions/cart.ts가 DB row를 CartCourse로 변환한다.

export type Weekday = "월" | "화" | "수" | "목" | "금"

export const WEEKDAYS: Weekday[] = ["월", "화", "수", "목", "금"]

// 장바구니에 담긴 과목 스냅샷. localStorage(sugang-cart-v1)에 그대로 직렬화된다.
export type CartCourse = {
  id: string
  name: string
  department: string
  professor: string
  credits: number
  code: string | null
  semester: string
  classroom: string | null
  timeSlots: string | null
}

// courses.classroom 원문("전주:공과대학 8호관 402 ")을 파싱한 결과.
export type ParsedLocation = {
  campus: string
  building: string
  room: string
}

export type ClassSession = {
  courseId: string
  courseName: string
  day: Weekday
  startMinutes: number
  endMinutes: number
  location: ParsedLocation | null
}

// 이동동선 지도에서 "한 건물에 머무는 구간" 단위. 같은 건물이 연속되면 하나로 묶는다.
export type CampusStop = {
  order: number
  location: ParsedLocation
  sessions: ClassSession[]
}

// 장바구니에 담으려는 과목이 이미 담긴 과목과 요일·시간이 겹칠 때의 충돌 정보.
export type TimeConflict = {
  newSession: ClassSession
  existingSession: ClassSession
  existingCourseName: string
}
