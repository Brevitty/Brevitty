import { useState } from 'react'
import { motion } from 'framer-motion'
import { AttendanceMeter } from '../junction/dashboard/shared.jsx'
import { ATTENDANCE_MIN_PCT, ASSIGNMENT_DONE, FEEDBACK_AREAS, RATING_MAX } from '../../data/vacRules.js'
import { formatDate, formatTime } from '../../lib/hubApi.js'
import { FILE_HINT } from '../../lib/storage.ts'
import { FileUploadButton, FileLink } from '../hub/FileUpload.jsx'
import {
  Page, ViewHeader, StatGrid, StatTile, Card, CardHead, ListRow, DataTable, Pill, LinkOut, Field, SaveNote,
  inputClass, primaryButton, ghostButton, viewItem, pad2,
} from '../hub/ui.jsx'

const pctText = (pct) => (pct === null ? '—' : `${pct}%`)
const isDone = (a) => ASSIGNMENT_DONE.includes(a.status)

/* ---------------- Overview ---------------- */
export function OverviewView({ data, navigate }) {
  const { learner, summary, certificate, nextClass, nextAssignment } = data
  return (
    <Page>
      <ViewHeader eyebrow="VAC Learner" title={learner.course} subtitle={`${learner.program} · Semester ${learner.semester} · Roll no. ${learner.roll_no}`} />
      <StatGrid>
        <StatTile n={1} label="Attendance" value={pctText(summary.pct)} sub={summary.pct === null ? 'No classes held yet' : summary.pct >= ATTENDANCE_MIN_PCT ? `Above the ${ATTENDANCE_MIN_PCT}% minimum` : `Below the ${ATTENDANCE_MIN_PCT}% minimum`} />
        <StatTile n={2} label="Assignments" value={`${certificate.done} / ${certificate.totalAssignments}`} sub={certificate.totalAssignments ? `${Math.round((certificate.done / certificate.totalAssignments) * 100)}% complete` : 'None set yet'} />
        <StatTile n={3} label="Sessions" value={pad2(summary.total)} sub={`${summary.held} held · ${summary.total - summary.held} to go`} />
        <StatTile n={4} label="Certificate" value={certificate.eligible ? 'Eligible' : 'Not yet'} sub={certificate.eligible ? 'All requirements met' : 'See Certificate for what’s left'} />
      </StatGrid>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHead n={1} title="Course" />
          <div className="mt-3">
            <ListRow label="Course" value={learner.course} />
            <ListRow label="Batch" value={learner.batch} />
            <ListRow label="Faculty" value={learner.faculty} />
          </div>
        </Card>
        <Card>
          <CardHead n={2} title="Next up" />
          <div className="mt-3">
            <ListRow label="Next class" value={nextClass ? `${nextClass.title} · ${formatDate(nextClass.date)}, ${formatTime(nextClass.time)}` : 'No more classes scheduled'} />
            <ListRow label="Next assignment" value={nextAssignment ? `${nextAssignment.title} · due ${formatDate(nextAssignment.due)}` : 'All submitted'} />
          </div>
          {nextAssignment && (
            <button type="button" onClick={() => navigate('assignments')} className={`${ghostButton} mt-4`}>
              Submit assignment
            </button>
          )}
        </Card>
      </div>
    </Page>
  )
}

/* ---------------- Course ---------------- */
export function CourseView({ data }) {
  const { learner, certificate, summary } = data
  return (
    <Page>
      <ViewHeader eyebrow="Course" title={learner.course} subtitle="Current value-added course information." />
      <Card className="mt-10">
        <CardHead title="Details" />
        <div className="mt-3">
          <ListRow label="Course" value={learner.course} />
          <ListRow label="Batch / section" value={learner.batch} />
          <ListRow label="Faculty" value={learner.faculty} />
          <ListRow label="Program" value={learner.program} />
          <ListRow label="Semester" value={learner.semester} />
          <ListRow label="Progress" value={`${summary.held} of ${summary.total} sessions held · ${certificate.done} of ${certificate.totalAssignments} assignments done`} />
        </div>
      </Card>
    </Page>
  )
}

/* ---------------- Schedule ---------------- */
export function ScheduleView({ data }) {
  const upcoming = data.sessions.filter((s) => s.status === 'upcoming').length
  return (
    <Page>
      <ViewHeader eyebrow="Schedule" title={`${upcoming} sessions to go.`} subtitle="Upcoming and completed learning sessions for your batch." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.session_id}
          rows={data.sessions}
          columns={[
            { key: 'date', label: 'Date', width: '150px', render: (r) => <span className="font-mono text-xs">{formatDate(r.date)}</span> },
            { key: 'time', label: 'Time', width: '130px', render: (r) => <span className="font-mono text-xs">{formatTime(r.time)}</span> },
            { key: 'title', label: 'Session', width: '1fr' },
            { key: 'when', label: '', width: '110px', render: (r) => <Pill tone={r.status === 'upcoming' ? 'active' : 'neutral'}>{r.status === 'upcoming' ? 'Upcoming' : 'Held'}</Pill> },
          ]}
          empty="No sessions scheduled yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Attendance (read-only) ---------------- */
const ATTENDANCE_LABEL = { present: 'Present', absent: 'Absent', upcoming: 'Upcoming' }
export function AttendanceView({ data }) {
  const { summary } = data
  return (
    <Page>
      <ViewHeader eyebrow="Attendance" title={summary.held === 0 ? 'No sessions held yet.' : `${summary.present} of ${summary.held} sessions attended so far.`} subtitle={`Certificate needs at least ${ATTENDANCE_MIN_PCT}%. Rate = present ÷ sessions held so far.`} />
      <motion.div variants={viewItem}>
        <AttendanceMeter presentCount={summary.present} heldCount={summary.held} />
      </motion.div>
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.session_id}
          rows={data.sessions}
          columns={[
            { key: 'title', label: 'Session', width: '1.4fr' },
            { key: 'date', label: 'Date', width: '150px', render: (r) => <span className="font-mono text-xs">{formatDate(r.date)}</span> },
            { key: 'status', label: 'Status', width: '120px', render: (r) => <Pill tone={r.status === 'present' ? 'done' : r.status === 'absent' ? 'warn' : 'neutral'}>{ATTENDANCE_LABEL[r.status] || r.status}</Pill> },
          ]}
        />
      </div>
    </Page>
  )
}

/* ---------------- Content ---------------- */
export function ContentView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="Content" title="Course materials." subtitle="Course materials and learning resources from your faculty." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.title}
          rows={data.content}
          columns={[
            { key: 'title', label: 'Content', width: '1.4fr' },
            { key: 'format', label: 'Format', width: '110px', render: (r) => <span className="font-mono text-xs">{r.format}</span> },
            { key: 'status', label: 'Status', width: '1fr', render: (r) => <Pill>{r.status}</Pill> },
            { key: 'link', label: 'Link', width: '110px', render: (r) => (r.link ? <LinkOut href={r.link} /> : <span className="text-xs text-black/40">In class</span>) },
          ]}
          empty="No materials published yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Assignments ---------------- */
// Upload (or re-upload) the assignment file; a reviewed assignment is read-only.
function SubmitFile({ assignment, onSubmit }) {
  if (assignment.status === 'reviewed') return <FileLink stored={assignment.link}>View</FileLink>
  return (
    <div className="flex flex-wrap items-start gap-3">
      {assignment.link && <FileLink stored={assignment.link}>View</FileLink>}
      <FileUploadButton
        target={{ pillar: 'vac', docId: assignment.assignment_id }}
        label={assignment.link ? 'Resubmit' : 'Upload'}
        ariaLabel={`${assignment.link ? 'Resubmit' : 'Upload'} ${assignment.title}`}
        className={ghostButton}
        onUploaded={onSubmit}
      />
    </div>
  )
}

export function AssignmentsView({ data, save, refetch }) {
  const done = data.assignments.filter(isDone).length
  // Returns an error string for FileUploadButton to show, or nothing on success.
  const submit = (id) => async ({ path }) => {
    try {
      await save('vac/assignments', { assignment_id: id, file_path: path }, (d, r) => ({
        ...d,
        assignments: d.assignments.map((a) => (a.assignment_id === r.assignment_id ? { ...a, ...r } : a)),
      }))
    } catch (err) {
      return err.message || 'Could not submit the assignment.'
    }
    refetch() // certificate eligibility + "next assignment" are computed server-side
  }
  return (
    <Page>
      <ViewHeader eyebrow="Assignments" title={`${done} of ${data.assignments.length} submitted.`} subtitle={`Upload each assignment file. ${FILE_HINT}.`} />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.assignment_id}
          rows={data.assignments}
          columns={[
            { key: 'title', label: 'Assignment', width: '1.3fr' },
            { key: 'due', label: 'Due', width: '130px', render: (r) => <span className="font-mono text-xs">{formatDate(r.due)}</span> },
            { key: 'status', label: 'Status', width: '130px', render: (r) => <Pill tone={isDone(r) ? (r.status === 'reviewed' ? 'done' : 'active') : r.due < data.today ? 'warn' : 'neutral'}>{!isDone(r) && r.due < data.today ? 'Overdue' : r.status}</Pill> },
            { key: 'submission', label: 'Submission', width: '1.2fr', render: (r) => <SubmitFile assignment={r} onSubmit={submit(r.assignment_id)} /> },
          ]}
          empty="No assignments set yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Certificate (computed, never hand-set) ---------------- */
export function CertificateView({ data }) {
  const { summary, certificate } = data
  const rows = [
    { req: `Attendance at least ${ATTENDANCE_MIN_PCT}%`, current: pctText(summary.pct), ok: certificate.attendanceOk },
    { req: 'All assignments submitted', current: `${certificate.done} / ${certificate.totalAssignments}`, ok: certificate.assignmentsOk },
  ]
  return (
    <Page>
      <ViewHeader
        eyebrow="Certificate"
        title={certificate.eligible ? 'You’re eligible for the certificate.' : 'Not eligible yet.'}
        subtitle="Eligibility is calculated from your attendance and assignments. It updates as soon as either changes."
      />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.req}
          rows={rows}
          columns={[
            { key: 'req', label: 'Requirement', width: '1.4fr' },
            { key: 'current', label: 'Current', width: '140px', render: (r) => <span className="font-mono font-semibold">{r.current}</span> },
            { key: 'ok', label: 'Status', width: '140px', render: (r) => <Pill tone={r.ok ? 'done' : 'warn'}>{r.ok ? 'Met' : 'Not met'}</Pill> },
          ]}
        />
      </div>
      <motion.div variants={viewItem} className={`mt-5 rounded-2xl p-6 ${certificate.eligible ? 'bg-[#0a0a0a] text-white' : 'border border-dashed border-black/15'}`}>
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${certificate.eligible ? 'text-white/45' : 'text-black/40'}`}>Certificate status</span>
        <p className={`mt-3 font-display text-2xl font-bold ${certificate.eligible ? 'text-white' : 'text-ink'}`}>
          {certificate.eligible ? 'Eligible — issued after the final session.' : 'Eligible once both requirements are met.'}
        </p>
      </motion.div>
    </Page>
  )
}

/* ---------------- Feedback ---------------- */
function FeedbackForm({ area, current, save }) {
  const [rating, setRating] = useState(current?.rating || 0)
  const [comment, setComment] = useState(current?.comment || '')
  const [state, setState] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await save('vac/feedback', { area: area.id, rating, comment: comment.trim() }, (d, r) => ({
        ...d,
        feedback: { ...d.feedback, [r.area]: { rating: r.rating, comment: r.comment, submittedDate: r.submittedDate } },
      }))
      setState({ saved: true })
    } catch (err) {
      setState({ error: err.message })
    }
  }
  return (
    <Card>
      <form onSubmit={submit}>
        <CardHead title={area.label} action={<Pill tone={current ? 'done' : 'neutral'}>{current ? `Sent ${formatDate(current.submittedDate)}` : 'Feedback pending'}</Pill>} />
        <fieldset className="mt-5">
          <legend className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Rating</legend>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                aria-label={`${n} of ${RATING_MAX}`}
                onClick={() => {
                  setRating(n)
                  setState(null)
                }}
                className={`h-10 w-10 rounded-full border font-mono text-sm font-semibold transition-colors ${n <= rating ? 'border-orange bg-orange text-[#0a0a0a]' : 'border-black/15 text-black/50 hover:border-orange/50'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <Field label="Comment (optional)" htmlFor={`fb-${area.id}`}>
            <textarea id={`fb-${area.id}`} rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={!rating || state?.saving} className={primaryButton}>
            {current ? 'Update feedback' : 'Send feedback'}
          </button>
          <SaveNote state={state} />
        </div>
      </form>
    </Card>
  )
}

export function FeedbackView({ data, save }) {
  const sent = FEEDBACK_AREAS.filter((a) => data.feedback[a.id]).length
  return (
    <Page>
      <ViewHeader eyebrow="Feedback" title={`${sent} of ${FEEDBACK_AREAS.length} feedback forms sent.`} subtitle="Tell us how the course, your faculty and the content are working for you." />
      <div className="mt-10 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {FEEDBACK_AREAS.map((a) => (
          <FeedbackForm key={a.id} area={a} current={data.feedback[a.id]} save={save} />
        ))}
      </div>
    </Page>
  )
}
