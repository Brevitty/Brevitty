import { motion } from 'framer-motion'
import { ProgressMeter } from '../junction/dashboard/shared.jsx'
import { PROFILE_SECTIONS } from '../../data/launchpadChecklist.js'
import { Page, ViewHeader, ListRow, Pill, cardClass, eyebrowClass, viewItem, ghostButton } from '../hub/ui.jsx'
import SectionForm from './SectionForm.jsx'

export default function ProfileView({ lp }) {
  const { data, completeness, saveField, navigate } = lp
  const { student, profile } = data

  return (
    <Page>
      <ViewHeader
        eyebrow="Profile"
        title={completeness.pct === 100 ? 'Every field filled. Strong profile.' : `Your profile is ${completeness.pct}% complete.`}
        subtitle="Text and links only. Upload files (resume, letters, certificates) in Documents."
      />
      <motion.div variants={viewItem}>
        <ProgressMeter done={completeness.filled} total={completeness.total} caption={`${completeness.filled} of ${completeness.total} profile fields filled`} />
      </motion.div>

      <div className="mt-10 space-y-5">
        {PROFILE_SECTIONS.map((section) => (
          <motion.section key={section.id} variants={viewItem} className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={eyebrowClass}>
                <span className="mr-2 text-black/30">[{section.n}]</span>
                {section.title}
              </span>
              {section.linked && <Pill tone="neutral">Linked from My Startup</Pill>}
            </div>

            {section.id === 'about' && (
              <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <div>
                  <ListRow label="Grade" value={student.grade} />
                  <ListRow label="School" value={student.school} />
                </div>
                <div>
                  <ListRow label="Guardian" value={student.guardian.name} />
                  <ListRow label="Guardian contact" value={student.guardian.contact} />
                  <ListRow label="Guardian consent" value={student.guardian.consent ? 'Given' : 'Pending'} />
                </div>
                <p className="mt-2 text-xs text-black/45 sm:col-span-2">Grade, school and guardian details are on your intake record. Ask the Launchpad team to change them.</p>
              </div>
            )}

            <div className="mt-6">
              {section.linked ? (
                <div>
                  <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {section.fields.map((f) => (
                      <div key={f.id}>
                        <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">{f.label}</dt>
                        <dd className="mt-1.5 text-sm leading-relaxed text-black/70">{profile[`${section.id}.${f.id}`] || 'Not added yet'}</dd>
                      </div>
                    ))}
                  </dl>
                  <button type="button" onClick={() => navigate('journey')} className={`${ghostButton} mt-4`}>
                    Edit in My Journey → My Startup
                  </button>
                </div>
              ) : (
                <SectionForm section={section} profile={profile} onSaveField={saveField} />
              )}
            </div>
          </motion.section>
        ))}
      </div>
    </Page>
  )
}
