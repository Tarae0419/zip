import { describe, expect, it } from "vitest"
import { applyOtpInputChange, normalizeOtpCode } from "./otp-input"

describe("OTP input", () => {
  it("자동완성으로 전달된 전체 인증코드를 한 번에 채운다", () => {
    expect(applyOtpInputChange("", 0, "123456")).toEqual({
      value: "123456",
      focusIndex: 5,
    })
  })

  it("숫자가 아닌 문자와 길이를 정규화한다", () => {
    expect(normalizeOtpCode("12 34-567")).toBe("123456")
  })

  it("모바일 입력 이벤트의 빈 값으로 현재 자리를 지운다", () => {
    expect(applyOtpInputChange("123456", 2, "")).toEqual({
      value: "12456",
      focusIndex: 2,
    })
  })

  it("한 자리 입력은 해당 자리를 교체하고 다음 칸으로 이동한다", () => {
    expect(applyOtpInputChange("123456", 2, "9")).toEqual({
      value: "129456",
      focusIndex: 3,
    })
  })

  it("기존 DOM 값 뒤에 붙은 키 입력을 다자리 자동완성으로 오인하지 않는다", () => {
    expect(applyOtpInputChange("123456", 2, "39")).toEqual({
      value: "129456",
      focusIndex: 3,
    })
  })

  it("아직 비어 있는 뒤쪽 칸을 눌러도 첫 빈 자리에 이어서 입력한다", () => {
    expect(applyOtpInputChange("12", 5, "9")).toEqual({
      value: "129",
      focusIndex: 3,
    })
  })
})
