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
