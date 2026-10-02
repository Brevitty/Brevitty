import { Link } from 'react-router-dom'

// The "My workspace" page: every workspace the signed-in account can open (HubChoosePage).
// /hub/choose rather than /hub, because /hub bounces a one-workspace account straight back in.
export const MY_WORKSPACE_PATH = '/hub/choose'

const TONES = {
  // Dashboard sidebars: token colours, so it flips with the dashboard's dark mode.
  surface: 'border-black/15 text-black/60 hover:border-orange/60 hover:text-orange',
  // The consulting shell's always-dark ink sidebar / top bar.
  ink: 'border-white/20 text-white/70 hover:border-orange hover:text-orange',
}

// Quiet ghost button back to My workspace. One component for every Hub shell.
export default function BackToWorkspace({ to = MY_WORKSPACE_PATH, tone = 'surface', className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${TONES[tone]} ${className}`}
    >
      <span aria-hidden="true">←</span>
      My workspace
    </Link>
  )
}
