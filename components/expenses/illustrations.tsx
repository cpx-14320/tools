/** 手繪風格的裝飾性 SVG 插圖——沒有圖片生成工具可用，改用幾何色塊拼出帶點活潑感的裝飾圖案，
 *  呼應使用者提供的配色參考（薰衣草紫＋深藏青＋馬卡龍色塊）。純裝飾，不帶任何資料。 */

export function LedgerIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="coinGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBCB7B" />
          <stop offset="1" stopColor="#E8A23D" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B8DD8" />
          <stop offset="1" stopColor="#6C5CE0" />
        </linearGradient>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#2A2550" floodOpacity="0.18" />
        </filter>
      </defs>

      <circle cx="60" cy="150" r="70" fill="#8B8DD8" opacity="0.14" />
      <circle cx="270" cy="50" r="50" fill="#F4A6C4" opacity="0.14" />

      {/* 傾斜的卡片／帳本 */}
      <g transform="translate(90 40) rotate(-8)" filter="url(#softShadow)">
        <rect width="150" height="96" rx="18" fill="url(#cardGrad)" />
        <rect x="18" y="24" width="70" height="8" rx="4" fill="white" opacity="0.85" />
        <rect x="18" y="42" width="100" height="6" rx="3" fill="white" opacity="0.5" />
        <rect x="18" y="56" width="60" height="6" rx="3" fill="white" opacity="0.5" />
        <circle cx="122" cy="70" r="16" fill="white" opacity="0.18" />
      </g>

      {/* 硬幣堆 */}
      <g filter="url(#softShadow)">
        <circle cx="70" cy="165" r="30" fill="url(#coinGrad)" />
        <circle cx="70" cy="165" r="21" fill="none" stroke="#FFF6E5" strokeWidth="2.5" opacity="0.8" />
        <text x="70" y="172" textAnchor="middle" fontSize="18" fontWeight="700" fill="#8A5A17">
          $
        </text>
        <circle cx="106" cy="182" r="20" fill="url(#coinGrad)" opacity="0.9" />
      </g>

      {/* 柔和三角形 */}
      <g filter="url(#softShadow)">
        <path d="M232 150 L264 96 L296 150 Z" fill="#DFF4EB" />
        <path d="M232 150 L264 96 L296 150 Z" fill="none" stroke="#2FAE82" strokeOpacity="0.25" strokeWidth="2" />
      </g>

      <circle cx="252" cy="178" r="7" fill="#F4A6C4" />
      <circle cx="28" cy="60" r="5" fill="#8B8DD8" />
    </svg>
  );
}

export function DashboardIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="presentation" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="0.3" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#B4B5E8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#B4B5E8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="30" r="90" fill="url(#glow)" />
      <g transform="translate(140 18)">
        <circle r="22" fill="#FBCB7B" />
        <circle r="15" fill="none" stroke="#FFF6E5" strokeWidth="2" opacity="0.85" />
      </g>
      <g transform="translate(170 56) rotate(12)">
        <rect x="-12" y="-12" width="24" height="24" rx="7" fill="#F4A6C4" opacity="0.85" />
      </g>
      <circle cx="118" cy="70" r="6" fill="#2FAE82" opacity="0.8" />
    </svg>
  );
}
