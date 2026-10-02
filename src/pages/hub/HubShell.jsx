// Shared page frame for the small hub state pages (choose / status / none / no-access).
export const HUB_TEAM_EMAIL = 'brevittyincubationhub@gmail.com'

export const primaryPill =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-orange px-7 py-3 text-sm font-bold text-ink shadow-[0_10px_30px_-10px_rgba(249,115,22,0.6)] transition-shadow hover:shadow-[0_14px_40px_-8px_rgba(249,115,22,0.7)]'

export const secondaryPill =
  'inline-flex min-h-[48px] items-center justify-center rounded-full border border-black/15 px-7 py-3 text-sm font-semibold text-ink transition-colors hover:border-black/30'

// `wide` gives the workspace grid room for three cards across.
export default function HubShell({ eyebrow, title, children, wide = false }) {
  return (
    <main className="relative min-h-screen bg-white px-6 pb-24 pt-32 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_35%_at_50%_0%,rgba(249,115,22,0.08),transparent_70%)]" />
      <div className={`relative mx-auto ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {eyebrow && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
