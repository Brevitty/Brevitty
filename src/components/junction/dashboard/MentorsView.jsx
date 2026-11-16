import { motion } from 'framer-motion'
import { viewContainer, viewItem } from './motionVariants.js'
import { useAssignedMentors } from '../../../lib/useAssignedMentors.js'

export default function MentorsView({ onUnauthorized }) {
  const { loading, error, mentors } = useAssignedMentors(onUnauthorized)

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-black/40">Loading mentors…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-sm font-medium text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <motion.div variants={viewContainer} initial="hidden" animate="show" className="p-6 lg:p-10">
      <motion.p variants={viewItem} className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">
        Your mentors
      </motion.p>
      <motion.h2 variants={viewItem} className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Assigned to your team.
      </motion.h2>

      {mentors.length === 0 ? (
        <motion.p variants={viewItem} className="mt-6 max-w-md text-sm text-black/55">
          No mentors assigned yet — check back once the program team pairs you with one.
        </motion.p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {mentors.map((m, i) => (
            <motion.div key={m.mentor_id} variants={viewItem} className="rounded-2xl border border-black/10 bg-surface p-7">
              <span className="font-mono text-sm font-semibold text-black/30">[{String(i + 1).padStart(2, '0')}]</span>
              <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-ink">{m.name}</h3>
              <p className="mt-1 text-sm text-black/55">{m.expertise}</p>
              {m.bio && <p className="mt-2 text-sm leading-relaxed text-black/50">{m.bio}</p>}
              <a
                href={`mailto:${m.contact_email}`}
                className="mt-4 inline-block text-sm font-semibold text-orange transition-opacity hover:opacity-70"
              >
                {m.contact_email}
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
