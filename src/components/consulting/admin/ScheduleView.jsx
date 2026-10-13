import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, Card, Button, Field, InlineError, Spinner, EmptyState, Loaded, inputClass, labelClass, viewItem, ORANGE_TEXT } from '../ui.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { istToday, fmtWeekday, fmtDate, fmtTime, fromMin, toMin, slotGrid } from '../../../lib/consultingTime.js'
import { DURATIONS_MIN } from '../../../data/consultingConstants.js'
import SlotPicker, { DurationPicker } from './SlotPicker.jsx'
import SessionRow from './SessionRow.jsx'
import { paths } from './paths.js'

const DEFAULT_DURATION = DURATIONS_MIN[DURATIONS_MIN.length - 1]

export default function ScheduleView() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const consultees = useLoad(admin.consultees, [])
  const [email, setEmail] = useState(params.get('email') || '')
  const [date, setDate] = useState(istToday())
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [start, setStart] = useState('')
  const [topic, setTopic] = useState('')
  const [meetLink, setMeetLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const day = useLoad(() => admin.sessions({ date }), [date])

  const daySessions = (date && day.data?.sessions) || []
  // A start picked before the duration/date changed may no longer fit; treat it as unpicked.
  const startOk = Boolean(start) && !day.loading && slotGrid(date, duration, daySessions).some((s) => s.start_time === start && !s.reason)
  const book = async () => {
    setBusy(true)
    setError('')
    try {
      const { session } = await admin.createSession({ email, date, start_time: start, duration_min: duration, topic: topic.trim(), meet_link: meetLink.trim() })
      navigate(paths.session(session.session_id))
    } catch (err) {
      setError(err.message)
      if (err.status === 409) {
        setStart('')
        day.reload() // someone else took it: show the fresh grid
      }
      setBusy(false)
    }
  }

  return (
    <Loaded load={consultees}>
      {({ consultees: people }) => {
        const person = people.find((c) => c.email === email)
        const end = startOk ? fromMin(toMin(start) + duration) : ''
        const ready = person && date && startOk && !busy
        return (
          <Page>
            <PageHeader n={3} eyebrow="Schedule" title="Book a session" subtitle="One consultant, one calendar: booked slots are blocked for everyone." />
            {!people.length ? (
              <motion.div variants={viewItem} className="mt-8">
                <EmptyState mark="00" title="No students yet" body="Add a student before booking a session." />
              </motion.div>
            ) : (
              <div className="grid gap-x-8 lg:grid-cols-[1fr_300px]">
                <div>
                  <Section n={1} title="Who">
                    <select value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} aria-label="Student">
                      <option value="">Choose a student…</option>
                      {[...people]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((c) => (
                          <option key={c.email} value={c.email}>
                            {c.name}
                            {c.startup_name ? ` · ${c.startup_name}` : ''}
                          </option>
                        ))}
                    </select>
                  </Section>

                  <Section n={2} title="When">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <Field label="Date" htmlFor="sch-date" className="sm:w-56">
                        <input
                          id="sch-date"
                          type="date"
                          min={istToday()}
                          value={date}
                          onChange={(e) => {
                            setDate(e.target.value)
                            setStart('')
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <div>
                        <p className={`${labelClass} mb-1.5`}>Duration</p>
                        <DurationPicker value={duration} onChange={setDuration} />
                      </div>
                    </div>
                  </Section>

                  <Section n={3} title="Slot" meta={date ? fmtWeekday(date) : ''}>
                    {!date ? (
                      <p className="text-sm text-black/45">Pick a date first.</p>
                    ) : day.loading ? (
                      <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
                        {Array.from({ length: 16 }, (_, i) => (
                          <div key={i} className="h-14 animate-pulse rounded-xl bg-black/[0.05]" />
                        ))}
                      </div>
                    ) : day.error ? (
                      <p className="text-sm text-red-600">
                        {day.error}{' '}
                        <button type="button" className="underline" onClick={day.reload}>
                          Retry
                        </button>
                      </p>
                    ) : (
                      <SlotPicker date={date} duration={duration} sessions={daySessions} value={start} onChange={setStart} />
                    )}
                  </Section>

                  <Section n={4} title="Topic">
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="e.g. Pitch deck review" className={inputClass} aria-label="Topic" />
                  </Section>

                  <Section n={5} title="Meeting link" meta="optional">
                    <input type="url" value={meetLink} onChange={(e) => setMeetLink(e.target.value)} maxLength={500} placeholder="https://meet.google.com/…" className={inputClass} aria-label="Meeting link" />
                  </Section>

                  {daySessions.length > 0 && (
                    <Section title={`Already on ${fmtDate(date)}`}>
                      <div className="space-y-2">
                        {daySessions.map((s) => (
                          <SessionRow key={s.session_id} session={s} showDate={false} />
                        ))}
                      </div>
                    </Section>
                  )}
                </div>

                {/* summary ticket */}
                <motion.aside variants={viewItem} className="mt-10 lg:sticky lg:top-8 lg:self-start">
                  <Card className="overflow-hidden border-ink">
                    <div className="bg-ink px-5 py-4">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-orange">Booking</p>
                    </div>
                    <dl className="space-y-4 p-5">
                      {[
                        ['Student', person ? person.name : '—'],
                        ['Date', date ? `${fmtWeekday(date)}, ${fmtDate(date)}` : '—'],
                        ['Time', startOk ? `${fmtTime(start)} – ${fmtTime(end)} IST` : '—'],
                        ['Topic', topic.trim() || '—'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className={labelClass}>{k}</dt>
                          <dd className={`mt-0.5 text-sm ${v === '—' ? 'text-black/30' : 'font-semibold text-ink'}`}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="border-t border-dashed border-black/15 p-5">
                      <Button className="w-full" disabled={!ready} onClick={book}>
                        {busy ? (
                          <>
                            <Spinner /> Booking…
                          </>
                        ) : (
                          'Book session →'
                        )}
                      </Button>
                      <div className="mt-2">
                        <InlineError message={error} />
                      </div>
                      {!ready && !busy && (
                        <p className={`text-xs ${ORANGE_TEXT}`}>{!person ? 'Choose a student.' : !startOk ? 'Pick a free slot.' : ''}</p>
                      )}
                    </div>
                  </Card>
                </motion.aside>
              </div>
            )}
          </Page>
        )
      }}
    </Loaded>
  )
}
