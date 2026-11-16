import { Link } from 'react-router-dom'
import RegisterShell, { primaryButton } from './RegisterShell.jsx'

// Shown only after the server has confirmed the row was written. `children` adds extra buttons (e.g. "Book another").
export default function DonePanel({ step, title = 'All set', message, children }) {
  return (
    <RegisterShell step={step} title={title}>
      <div role="status" className="rounded-3xl border border-black/10 bg-white/90 p-7 text-center shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9">
        <p className="text-base font-medium text-green-700">{message}</p>
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {children}
          <Link to="/register" className={children ? 'inline-flex min-h-[48px] items-center justify-center rounded-full border border-black/15 bg-white px-7 text-sm font-semibold text-ink hover:border-black/35' : primaryButton}>
            Back to options
          </Link>
        </div>
      </div>
    </RegisterShell>
  )
}
