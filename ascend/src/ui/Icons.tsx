import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = ({ size = 22, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...rest,
})

export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></svg>
)
export const IconCompass = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>
)
export const IconLibrary = (p: P) => (
  <svg {...base(p)}><path d="M5 4v16M9.5 4v16M14 5l4.5 14.5" /></svg>
)
export const IconAscend = (p: P) => (
  <svg {...base(p)}><path d="M3.5 19.5h4v-4h4v-4h4v-4h5" /><circle cx="20.5" cy="4" r="1" fill="currentColor" stroke="none" /></svg>
)
export const IconChart = (p: P) => (
  <svg {...base(p)}><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg>
)
export const IconPlay = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z" /></svg>
)
export const IconPause = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><rect x="6.5" y="5" width="3.8" height="14" rx="1" /><rect x="13.7" y="5" width="3.8" height="14" rx="1" /></svg>
)
/** Skip back — in RTL the arrow runs toward the right, the direction of "earlier". */
export const IconBack = ({ seconds = 15, ...p }: P & { seconds?: number }) => (
  <svg {...base(p)}>
    <path d="M10 4.2A8 8 0 1 1 4.5 9.3" />
    <path d="M13 1.4 10 4.2 13 7" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="7" fontWeight="600" fill="currentColor" stroke="none" fontFamily="Assistant, sans-serif">{seconds}</text>
  </svg>
)
export const IconForward = ({ seconds = 15, ...p }: P & { seconds?: number }) => (
  <svg {...base(p)}>
    <path d="M14 4.2A8 8 0 1 0 19.5 9.3" />
    <path d="M11 1.4 14 4.2 11 7" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="7" fontWeight="600" fill="currentColor" stroke="none" fontFamily="Assistant, sans-serif">{seconds}</text>
  </svg>
)
export const IconDown = (p: P) => (
  <svg {...base(p)}><path d="m6 9.5 6 5.5 6-5.5" /></svg>
)
export const IconChevron = (p: P) => (
  <svg {...base(p)}><path d="m14.5 6-6 6 6 6" /></svg>
)
export const IconForwardChevron = (p: P) => (
  <svg {...base(p)}><path d="m9.5 6 6 6-6 6" /></svg>
)
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconBookmark = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}><path d="M7 4h10v16l-5-3.6L7 20z" /></svg>
)
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
)
export const IconSettings = (p: P) => (
  <svg {...base(p)}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
)
export const IconMoon = (p: P) => (
  <svg {...base(p)}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" /></svg>
)
export const IconList = (p: P) => (
  <svg {...base(p)}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".8" fill="currentColor" /><circle cx="4.5" cy="12" r=".8" fill="currentColor" /><circle cx="4.5" cy="18" r=".8" fill="currentColor" /></svg>
)
export const IconFlame = (p: P) => (
  <svg {...base(p)}><path d="M12 21c3.6 0 6-2.4 6-5.8 0-3.7-3-6-4-9.2-1.8 1.6-2.4 3.5-2.3 5.2C10.6 10.4 9.8 9.3 9.6 8 7.4 10 6 12.4 6 15.2 6 18.6 8.4 21 12 21z" /></svg>
)
export const IconUpload = (p: P) => (
  <svg {...base(p)}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4" /></svg>
)
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>
)
export const IconSpark = (p: P) => (
  <svg {...base(p)}><path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z" /></svg>
)
export const IconHeadphones = (p: P) => (
  <svg {...base(p)}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3.5" y="14" width="4" height="6" rx="1.5" /><rect x="16.5" y="14" width="4" height="6" rx="1.5" /></svg>
)
export const IconPen = (p: P) => (
  <svg {...base(p)}><path d="M14.5 5.5 18.5 9.5 9 19H5v-4z" /></svg>
)
export const IconLock = (p: P) => (
  <svg {...base(p)}><rect x="5.5" y="11" width="13" height="9" rx="2" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>
)

/** One line icon per learning area. */
export function AreaIcon({ id, size = 22 }: { id: string; size?: number }) {
  const p = base({ size, strokeWidth: 1.5 })
  switch (id) {
    case 'money':
      return (
        <svg {...p}>
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
        </svg>
      )
    case 'persuasion':
      return (
        <svg {...p}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5z" />
          <path d="M16 9h1.5A2.5 2.5 0 0 1 20 11.5v4a2.5 2.5 0 0 1-2 2.45V20l-3-2h-3" />
        </svg>
      )
    case 'psychology':
      return (
        <svg {...p}>
          <path d="M9.5 20v-3H7a2 2 0 0 1-2-2v-2.5L3.5 11 5 8.5A7 7 0 0 1 19 9c0 2.4-1 4-2.5 5.2V20" />
          <path d="M10 9.5a2 2 0 1 1 3 1.7V13" />
        </svg>
      )
    case 'communication':
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16.5" cy="9.5" r="2.5" />
          <path d="M2.5 19a5.5 5.5 0 0 1 11 0M13.5 15.2A4.5 4.5 0 0 1 21 18.5" />
        </svg>
      )
    case 'confidence':
      return (
        <svg {...p}>
          <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
      )
    case 'discipline':
      return (
        <svg {...p}>
          <circle cx="12" cy="13" r="7.5" />
          <path d="M12 9v4l2.5 2M9.5 2.5h5M12 2.5v3" />
        </svg>
      )
    case 'business':
      return (
        <svg {...p}>
          <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
          <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17" />
        </svg>
      )
    case 'leadership':
      return (
        <svg {...p}>
          <path d="M3.5 8 7.5 12 12 5l4.5 7 4-4-1.8 10.5H5.3z" />
        </svg>
      )
    default:
      return (
        <svg {...p}>
          <path d="M12 20c-4.4 0-8-3.4-8-8 3.9 0 6.8 1.7 8 4.6M12 20c4.4 0 8-3.4 8-8-3.9 0-6.8 1.7-8 4.6M12 16.6V9" />
          <path d="M12 9c-1.6-1.4-1.9-3.4-.9-5.5 2 .8 2.9 2.6 2.4 4.5" />
        </svg>
      )
  }
}
export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5V19" />
  </svg>
)
export const IconLotus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19c-3.5 0-7-2-8.5-5.5 2.6-.4 5 .4 6.6 2M12 19c3.5 0 7-2 8.5-5.5-2.6-.4-5 .4-6.6 2M12 19c-2.2-1.8-3.2-4.2-3-7 .2-2.3 1.4-4.4 3-6 1.6 1.6 2.8 3.7 3 6 .2 2.8-.8 5.2-3 7z" />
  </svg>
)
export const IconQuiz = (p: P) => (
  <svg {...base(p)}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 16.5v.01" />
  </svg>
)
export const IconChat = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
    <path d="M8.5 9.5h7M8.5 12.5h4.5" />
  </svg>
)
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
  </svg>
)
