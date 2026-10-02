// Small hand-authored line-icon set for the dashboard shell — matches the
// project's existing convention of inline SVG paths (see Navbar.jsx) rather
// than pulling in an icon-library dependency for a fixed, small icon set.

const base = 'h-full w-full'
const wrap = (children) => (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className || base}
  >
    {children}
  </svg>
)

export const GridIcon = wrap(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </>
)

export const CompassIcon = wrap(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8Z" />
  </>
)

export const UsersIcon = wrap(
  <>
    <circle cx="8.5" cy="8" r="3" />
    <path d="M2.5 20c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3" />
    <circle cx="17" cy="8.5" r="2.5" />
    <path d="M15.3 14.9c2.4.4 4 2.1 4.5 4.6" />
  </>
)

export const CalendarIcon = wrap(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </>
)

export const CalendarCheckIcon = wrap(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4M8.5 14.5l2 2 4.5-4.5" />
  </>
)

export const BookIcon = wrap(
  <>
    <path d="M4 5c2.2-1 5-1 8 .5V19c-3-1.5-5.8-1.5-8-.5V5Z" />
    <path d="M20 5c-2.2-1-5-1-8 .5V19c3-1.5 5.8-1.5 8-.5V5Z" />
  </>
)

export const FileIcon = wrap(
  <>
    <path d="M6 3.5h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h4.5M8.5 13h7M8.5 16.5h7" />
  </>
)

export const BellIcon = wrap(
  <>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 14 6 10Z" />
    <path d="M9.7 19a2.3 2.3 0 0 0 4.6 0" />
  </>
)

export const GearIcon = wrap(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8 6.3 6.3" />
  </>
)

export const SignOutIcon = wrap(
  <>
    <path d="M9 4.5H5.5A1.5 1.5 0 0 0 4 6v12a1.5 1.5 0 0 0 1.5 1.5H9" />
    <path d="M14.5 16.5 19 12l-4.5-4.5M19 12H9" />
  </>
)

export const ArrowRightIcon = wrap(<path d="M4.5 12h15M14 6l6 6-6 6" />)

export const ChevronRightIcon = wrap(<path d="M9 5.5 15.5 12 9 18.5" />)

export const CheckIcon = wrap(<path d="M5 12.5 9.5 17 19 6.5" />)

export const SunIcon = wrap(
  <>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
  </>
)

export const MoonIcon = wrap(
  <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z" />
)

export const VideoIcon = wrap(
  <>
    <rect x="3" y="6.5" width="12.5" height="11" rx="1.5" />
    <path d="M15.5 10.3 21 8v8l-5.5-2.3Z" />
  </>
)

export const ChatIcon = wrap(
  <path d="M4 5.5h16v10.5H9.5L5 19.5V16H4V5.5Z" />
)

export const DocumentActivityIcon = FileIcon

// Hero decoration: mountain-climber silhouette on a gradient sun, built as a
// flat inline SVG (same hand-authored convention as the icons above) rather
// than an image asset — nothing in the repo to source a photo/illustration
// from, and this keeps it a zero-dependency, themeable shape.
export function MountainClimberIllustration({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className || 'h-full w-full'} aria-hidden="true">
      <defs>
        <radialGradient id="hero-sun" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#hero-sun)" />
      <path d="M0 78 L16 54 L28 66 L44 38 L58 58 L72 46 L100 80 L100 100 L0 100 Z" fill="#0a0a0a" opacity="0.28" />
      <path d="M22 100 L46 52 L54 62 L68 40 L100 100 Z" fill="#0a0a0a" />
      <g fill="#0a0a0a">
        <rect x="63" y="34" width="4.5" height="6" rx="1" transform="rotate(18 63 34)" />
        <circle cx="68.5" cy="34.5" r="3" />
        <path d="M65.5 37 Q68.5 41 71 38 L74 47 Q69 51 64 48 Z" />
        <path d="M65 46 L62 54 M70 46 L73 54" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/* ---- added for the Launchpad Abroad / Incubation / VAC Learner workspaces ---- */
export const IdCardIcon = wrap(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2.2" />
    <path d="M5.8 16.5c.5-1.7 1.7-2.6 3.2-2.6s2.7.9 3.2 2.6M14.5 10h4M14.5 13.5h3" />
  </>
)

export const ChartIcon = wrap(<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6.5" />)

export const ShieldIcon = wrap(
  <>
    <path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.7-7 9-4.1-1.3-7-4.7-7-9V6l7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </>
)

export const CoinIcon = wrap(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 8.5h5M9.5 11.5h5M11 8.5c2.5 0 2.5 3 0 3H9.5l4 4.5" />
  </>
)

export const MegaphoneIcon = wrap(<path d="M4 10v4h3l7 4V6L7 10H4ZM17.5 9.5a3.5 3.5 0 0 1 0 5M7 14l1.5 5h2.5L10 15" />)

export const FlagIcon = wrap(<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11" />)

export const AwardIcon = wrap(
  <>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m9 13.8-1.5 6.7 4.5-2.5 4.5 2.5-1.5-6.7" />
  </>
)

export const ClipboardIcon = wrap(
  <>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3h6v1.5M8.5 11l2 2 4-4M8.5 16.5h7" />
  </>
)

export const ClockIcon = wrap(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>
)
