import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR, Poppins } from 'next/font/google'
import { CartProvider } from '@/components/cart-provider'
import './globals.css'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
})

const tmapPublicMapKey = process.env.NEXT_PUBLIC_TMAP_MAP_KEY?.trim()
const tmapVectorSdkUrl = tmapPublicMapKey
  ? `https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=${encodeURIComponent(tmapPublicMapKey)}`
  : null

export const metadata: Metadata = {
  title: '수강길잡이 — AI 수강 도우미',
  description:
    '대학생을 위한 AI 기반 수강 도우미. 과목 리뷰 요약, 분야별 과목 탐색, 맞춤 커리큘럼 설계를 한 곳에서.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`bg-background ${notoSansKr.variable} ${poppins.variable}`}
    >
      <head>
        {tmapVectorSdkUrl ? (
          <>
            {/*
              TMAP's bootstrap synchronously document.write()s its SDK and stylesheet.
              It must remain a parser-time script; next/script strategies load it too late.
            */}
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script id="tmap-vector-sdk" src={tmapVectorSdkUrl} />
          </>
        ) : null}
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-2 font-semibold text-background shadow-elevated focus:translate-y-0"
        >
          본문으로 건너뛰기
        </a>
        <CartProvider>{children}</CartProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
