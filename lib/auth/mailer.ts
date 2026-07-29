import nodemailer from "nodemailer"

// 회원가입 이메일 인증코드 발송. 기존에 쓰던 이메일 계정의 SMTP로 보낸다(Resend 같은 별도
// 서비스 신규 가입 없이) — Gmail이면 SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true,
// SMTP_USER=본인 Gmail 주소, SMTP_PASS=Google 계정 "앱 비밀번호"(2단계 인증 필요).
// 네이버면 SMTP_HOST=smtp.naver.com, 나머지는 동일한 패턴 — 둘 다 .env.local에 채워 넣으면 된다.
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465
const SMTP_SECURE = process.env.SMTP_SECURE !== "false"
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  }
  return transporter
}

export async function sendVerificationCodeEmail(email: string, code: string): Promise<void> {
  const t = getTransporter()

  if (!t) {
    // SMTP_* 환경변수가 아직 없는 로컬 개발 환경 — 실제 발송 대신 콘솔에 코드만 남긴다.
    // 프로덕션에 배포하기 전에는 반드시 SMTP_HOST/PORT/USER/PASS를 .env.local과 Vercel 환경변수에 채워야 한다.
    console.warn(`[mailer] SMTP 설정이 없어 이메일을 발송하지 않았습니다. ${email}로 보낼 인증코드: ${code}`)
    return
  }

  await t.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "[수강길잡이] 이메일 인증코드",
    text: `인증코드: ${code}\n\n10분 안에 입력해주세요.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 12px;">수강길잡이 이메일 인증</h2>
        <p style="color: #555;">아래 인증코드를 회원가입 화면에 입력해주세요. 10분 후 만료됩니다.</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 20px 0;">${code}</p>
        <p style="color: #999; font-size: 12px;">본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
      </div>
    `,
  })
}
