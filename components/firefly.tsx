// 홈 히어로 장식용 반딧불이 — 순수 장식(aria-hidden, pointer-events-none)이라 콘텐츠에 영향 없다.
// 사선으로 은은하게 오가는 큰 움직임(firefly-fly)과 날갯짓/위아래 흔들림(firefly-bob/wing) 애니메이션은
// prefers-reduced-motion 사용자에게는 app/globals.css의 일괄 override로 꺼진다.
export function Firefly() {
  return (
    <div
      aria-hidden="true"
      className="firefly-fly pointer-events-none absolute left-[8%] top-0 size-11 opacity-60 md:left-[14%] md:top-[-6%] md:size-14"
    >
      <div className="firefly-bob size-full">
        <svg viewBox="0 0 680 420" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="firefly-glow" className="firefly-glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffd76a" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffd76a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="340" cy="370" rx="80" ry="12" fill="#3d3480" opacity="0.06" />
          <circle cx="380" cy="290" r="70" fill="url(#firefly-glow)" />
          <g className="firefly-wing">
            <ellipse
              cx="255"
              cy="180"
              rx="60"
              ry="80"
              fill="#f5f3ff"
              fillOpacity="0.5"
              stroke="#c9c2f5"
              strokeWidth="2"
              transform="rotate(-20 255 180)"
            />
          </g>
          <g className="firefly-wing firefly-wing-right">
            <ellipse
              cx="425"
              cy="180"
              rx="60"
              ry="80"
              fill="#f5f3ff"
              fillOpacity="0.5"
              stroke="#c9c2f5"
              strokeWidth="2"
              transform="rotate(20 425 180)"
            />
          </g>
          <ellipse cx="340" cy="210" rx="80" ry="90" fill="#7c6cf0" stroke="#5b4bd6" strokeWidth="4" />
          <path
            d="M300 275 Q340 320 320 355 Q345 340 340 380 Q365 345 380 355 Q365 315 300 275Z"
            fill="#ffd76a"
            stroke="#e8b93e"
            strokeWidth="3"
          />
          <ellipse cx="340" cy="185" rx="62" ry="55" fill="#f5f3ff" stroke="#c9c2f5" strokeWidth="3" />
          <circle cx="315" cy="180" r="8" fill="#3d3480" />
          <circle cx="365" cy="180" r="8" fill="#3d3480" />
          <circle cx="318" cy="177" r="2.5" fill="#f5f3ff" />
          <circle cx="368" cy="177" r="2.5" fill="#f5f3ff" />
          <ellipse cx="298" cy="200" rx="10" ry="6" fill="#e8543e" opacity="0.3" />
          <ellipse cx="382" cy="200" rx="10" ry="6" fill="#e8543e" opacity="0.3" />
          <path d="M315 205 Q340 220 365 205" stroke="#3d3480" strokeWidth="4" fill="none" strokeLinecap="round" />
          <line x1="315" y1="135" x2="300" y2="115" stroke="#5b4bd6" strokeWidth="3" strokeLinecap="round" />
          <line x1="365" y1="135" x2="380" y2="115" stroke="#5b4bd6" strokeWidth="3" strokeLinecap="round" />
          <circle cx="300" cy="112" r="5" fill="#7c6cf0" stroke="#5b4bd6" strokeWidth="2" />
          <circle cx="380" cy="112" r="5" fill="#7c6cf0" stroke="#5b4bd6" strokeWidth="2" />
          <path d="M300 240 L275 265" stroke="#5b4bd6" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M380 240 L405 265" stroke="#5b4bd6" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
