// Smallest check that fails if the consulting rules break. No Sheets, no network.
// Usage: node scripts/check-consulting-logic.mjs
import assert from 'node:assert/strict'
import {
  addDays, findConflict, isDate, overlaps, sameEmail, slotError, toMin, fromMin, ApiError, cleanLink, cleanEmail,
  sessionOver, inputBlockedReason, parseSlotToken, slotToken, isFlag,
} from '../api/_lib/consulting/rules.js'
import { studentItems, sirItems, waitingOnSir } from '../api/_lib/consulting/missing.js'
import { PILLARS, getPillar, isAdminPillar, pillarHref } from '../src/data/hubPillars.js'
import { landingPath, destinationAfterLogin } from '../src/lib/hubAccess.js'

const slot = (date, start_time, end_time) => ({ date, start_time, end_time })

// slots: grid, hours, duration
assert.equal(slotError(slot('2026-10-05', '10:00', '11:00')), '')
assert.equal(slotError(slot('2026-10-05', '17:30', '18:00')), '')
assert.equal(slotError(slot('2026-10-05', '10:00', '10:45')), '') // 45 min is allowed
assert.match(slotError(slot('2026-10-05', '09:30', '10:00')), /10:00/) // before the day starts
assert.match(slotError(slot('2026-10-05', '17:30', '18:30')), /10:00/) // past the day end
assert.match(slotError(slot('2026-10-05', '10:15', '11:15')), /30-minute/) // off-grid
assert.match(slotError(slot('2026-10-05', '10:00', '12:00')), /Duration/) // 120 min
assert.match(slotError(slot('2026-02-30', '10:00', '11:00')), /date/) // impossible date

// overlap: touching edges are fine, any shared minute is not, other days never clash
assert.equal(overlaps(slot('d', '10:00', '11:00'), slot('d', '11:00', '12:00')), false)
assert.equal(overlaps(slot('d', '10:00', '11:00'), slot('d', '10:30', '11:30')), true)
assert.equal(overlaps(slot('d', '10:00', '11:00'), slot('e', '10:00', '11:00')), false)

// conflicts: cancelled sessions free the slot; a session never conflicts with itself
const existing = [
  { session_id: 'a', status: 'scheduled', ...slot('d', '10:00', '11:00') },
  { session_id: 'b', status: 'cancelled', ...slot('d', '11:00', '12:00') },
]
assert.equal(findConflict(slot('d', '10:30', '11:30'), existing)?.session_id, 'a')
assert.equal(findConflict(slot('d', '11:00', '12:00'), existing), null)
assert.equal(findConflict(slot('d', '10:00', '11:00'), existing, 'a'), null)

// helpers
assert.equal(addDays('2026-12-31', 1), '2027-01-01')
assert.equal(addDays('2026-03-01', -1), '2026-02-28')
assert.equal(isDate('2026-10-05'), true)
assert.equal(isDate('2026-13-01'), false)
assert.equal(fromMin(toMin('16:45')), '16:45')
assert.equal(sameEmail(' A@B.com ', 'a@b.COM'), true)
assert.equal(cleanEmail(' A@B.com '), 'a@b.com')
assert.throws(() => cleanEmail('nope'), ApiError)
assert.throws(() => cleanLink('javascript:alert(1)'), ApiError) // links render as <a href>, so only http(s)
assert.equal(cleanLink('https://example.com/x'), 'https://example.com/x')

// student input window: only after the session ends, never for cancelled/no-show
const NOW = Date.parse('2026-10-05T12:00:00+05:30')
const s = (status, date, end_time, extra = {}) => ({ status, date, start_time: '10:00', end_time, mom: '', tasks: [], deliverables: [], ...extra })
assert.equal(sessionOver(s('completed', '2026-10-05', '11:30'), NOW), true)
assert.equal(sessionOver(s('scheduled', '2026-10-05', '12:30'), NOW), false) // still running
assert.equal(inputBlockedReason(s('scheduled', '2026-10-05', '11:00'), NOW), '') // ended, not yet marked completed
assert.match(inputBlockedReason(s('scheduled', '2026-10-06', '11:00'), NOW), /ended/)
assert.match(inputBlockedReason(s('cancelled', '2026-10-01', '11:00'), NOW), /cancelled/)
assert.match(inputBlockedReason(s('no_show', '2026-10-01', '11:00'), NOW), /cancelled or missed/)
// ---- the shared "what is missing" rules (student Home and sir's Today both call these) ----
const kinds = (items) => items.map((i) => i.kind).sort()
const done = (extra) => s('completed', '2026-10-01', '11:00', extra)
// finished session: no minutes, a pending deliverable, an overdue open task, a future open task
const messy = done({
  session_id: 's1',
  tasks: [{ task_id: 't1', status: 'open', task: 'a', due_date: '2026-10-02' }, { task_id: 't2', status: 'open', task: 'b', due_date: '2026-10-20' }],
  deliverables: [{ deliverable_id: 'd1', status: 'pending', title: 'x' }, { deliverable_id: 'd2', status: 'submitted', title: 'y' }],
})
assert.deepEqual(kinds(studentItems(messy, NOW)), ['deliverable', 'mom', 'task'])
assert.deepEqual(kinds(studentItems({ ...messy, mom: 'written' }, NOW)), ['deliverable', 'task'])
assert.deepEqual(studentItems(s('scheduled', '2026-10-09', '11:00', { tasks: messy.tasks, deliverables: messy.deliverables }), NOW).map((i) => i.kind), ['task']) // upcoming: only an overdue task counts
assert.deepEqual(studentItems(s('completed', '2026-10-01', '11:00', { mom: 'x', tasks: [{ status: 'done', due_date: '2026-09-01' }] }), NOW), []) // all clear

// sir's side: minutes, tasks and deliverables missing on a finished session
assert.deepEqual(kinds(sirItems(done(), NOW)), ['deliverables', 'mom', 'tasks'])
assert.deepEqual(kinds(sirItems(done({ mom: 'x' }), NOW)), ['deliverables', 'tasks'])
assert.deepEqual(sirItems(done({ mom: 'x', no_tasks: 'TRUE', no_deliverables: 'TRUE' }), NOW), []) // "no tasks" / "no deliverables" flags
assert.deepEqual(kinds(sirItems(done({ mom: 'x', no_tasks: 'TRUE' }), NOW)), ['deliverables']) // each flag only covers its own kind
assert.deepEqual(sirItems(done({ mom: 'x', tasks: [{ status: 'open' }], deliverables: [{ status: 'pending' }] }), NOW), []) // has some: nothing to add
assert.deepEqual(kinds(sirItems(done({ mom: 'x', no_tasks: '' }), NOW)), ['deliverables', 'tasks']) // flag cleared (a task was added and removed again)
assert.deepEqual(sirItems(s('scheduled', '2026-10-09', '11:00'), NOW), []) // not finished yet
assert.deepEqual(kinds(waitingOnSir(done(), NOW)), ['deliverables', 'tasks']) // the student sees his items minus the minutes

// cancelled / no-show / removed sessions never count anything, on either side
for (const extra of [{ status: 'cancelled' }, { status: 'no_show' }, { archived: 'TRUE' }]) {
  const dead = { ...messy, ...extra }
  assert.deepEqual([studentItems(dead, NOW), sirItems(dead, NOW), waitingOnSir(dead, NOW)], [[], [], []], JSON.stringify(extra))
}
assert.match(inputBlockedReason(s('cancelled', '2026-10-01', '11:00'), NOW), /cancelled/) // and no MoM can be filed for one

// reschedule token round-trips; garbage is ignored
assert.deepEqual(parseSlotToken(slotToken({ date: '2026-10-08', start_time: '12:00', end_time: '12:30' })), { date: '2026-10-08', start_time: '12:00', end_time: '12:30' })
assert.equal(parseSlotToken(''), null)
assert.equal(parseSlotToken('2026-13-40|99:00|x'), null)
assert.equal(isFlag('TRUE'), true)
assert.equal(isFlag(''), false)

// ---- Hub workspaces: 6 user cards in order, Admin never among them, coming-soon cards don't open ----
const userPillars = PILLARS.filter((p) => !p.adminOnly).map((p) => p.id)
assert.deepEqual(userPillars, ['startup', 'consulting', 'launchpad', 'incubation', 'vac', 'partner'])
assert.equal(userPillars.length, 6)
assert.deepEqual(PILLARS.filter((p) => p.adminOnly).map((p) => p.id), ['admin'])
assert.equal(isAdminPillar('admin'), true)
assert.equal(isAdminPillar('startup'), false)
assert.equal(pillarHref(getPillar('startup')), '/hub/startup')
assert.equal(pillarHref(getPillar('consulting')), '/consulting')
assert.equal(pillarHref(getPillar('launchpad')), '/hub/launchpad')
assert.equal(pillarHref(getPillar('partner')), '/hub/partner')
assert.equal(pillarHref(getPillar('admin')), null) // coming soon

// Hub landing: one workspace goes straight in, several land on My workspace
const approved = (...ids) => ids.map((pillar) => ({ pillar, status: 'approved' }))
assert.equal(landingPath(approved('startup')), '/hub/startup')
assert.equal(landingPath(approved('consulting')), '/consulting')
assert.equal(landingPath(approved('startup', 'consulting')), '/hub/choose')
assert.equal(landingPath(approved('partner')), '/hub/partner')
assert.equal(landingPath(approved('admin')), '/hub/choose') // a single coming-soon workspace still lands on My workspace
assert.equal(landingPath(approved('incubation')), '/hub/incubation')
assert.equal(landingPath(approved(...userPillars)), '/hub/choose')
assert.equal(landingPath([{ pillar: 'vac', status: 'pending' }]), '/hub/status')
assert.equal(landingPath([]), '/hub/none')
assert.equal(destinationAfterLogin('//evil.com', approved('startup')), '/hub/startup') // open-redirect guard still holds

console.log('consulting logic: all checks passed')
