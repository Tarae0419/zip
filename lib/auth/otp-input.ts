export type OtpInputChange = {
  value: string
  focusIndex: number
}

export function normalizeOtpCode(raw: string, length = 6): string {
  return raw.replace(/\D/g, "").slice(0, length)
}

export function applyOtpInputChange(
  currentValue: string,
  index: number,
  raw: string,
  length = 6,
): OtpInputChange {
  const current = normalizeOtpCode(currentValue, length)
  let digits = raw.replace(/\D/g, "")

  if (!digits) {
    const chars = current.split("")
    if (index < chars.length) chars.splice(index, 1)
    return {
      value: chars.join(""),
      focusIndex: Math.min(index, chars.length, length - 1),
    }
  }

  const existingDigit = current[index]
  if (digits.length === 2 && existingDigit) {
    if (digits[0] === existingDigit) digits = digits[1]
    else if (digits[1] === existingDigit) digits = digits[0]
  }

  const insertionIndex = Math.min(index, current.length, length - 1)

  if (digits.length > 1) {
    const value = `${current.slice(0, insertionIndex)}${digits}${current.slice(insertionIndex + digits.length)}`.slice(0, length)
    return {
      value,
      focusIndex: Math.min(insertionIndex + digits.length, length) - 1,
    }
  }

  const chars = current.split("")
  chars[insertionIndex] = digits
  return {
    value: chars.join("").slice(0, length),
    focusIndex: Math.min(insertionIndex + 1, length - 1),
  }
}
