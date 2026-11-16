// Offline checks for the Incubation rules (no sheet, no network): node scripts/check-incubation-logic.mjs
import assert from 'node:assert/strict'
import { addYears, trendOf, docStatus, quarterOf, periodKey } from '../src/data/incubationRules.js'
import { fileProblem, MAX_FILE_BYTES, fileNameOf, fileHref, isLink } from '../src/data/fileRules.js'
import { parsePath } from '../api/_lib/files.js'
import '../api/_lib/incubationSheet.js' // import smoke test: every named import it needs must exist

// MoU renewal = upload date + exactly 3 years (the spec's own example), leap day clamps like Postgres.
assert.equal(addYears('2026-10-06', 3), '2029-10-06')
assert.equal(addYears('2028-02-29', 3), '2031-02-28')
assert.equal(addYears('2024-02-29', 4), '2028-02-29')
assert.equal(addYears('2026-12-31', 3), '2029-12-31')

assert.equal(trendOf(10, 12), 'Growing')
assert.equal(trendOf(10, 10), 'Stable')
assert.equal(trendOf(10, 8), 'Declining')
assert.equal(trendOf(NaN, 8), '') // no previous quarter -> no trend
assert.equal(trendOf(0, 0), 'Stable')

assert.equal(docStatus(undefined), 'Not uploaded')
assert.equal(docStatus({ status: 'submitted' }), 'Submitted')
assert.equal(docStatus({ status: 'verified' }), 'Verified')

assert.equal(fileProblem({ name: 'a.pdf', size: 1 }), null)
assert.equal(fileProblem({ name: 'A.JPEG', size: MAX_FILE_BYTES }), null)
assert.ok(fileProblem({ name: 'a.exe', size: 1 }))
assert.ok(fileProblem({ name: 'noext', size: 1 }))
assert.ok(fileProblem({ name: 'a.pdf', size: MAX_FILE_BYTES + 1 }))
assert.ok(fileProblem({ name: 'a.pdf', size: 0 }))
assert.equal(fileProblem({ name: 'a.png' }), null) // registration check: name only
assert.equal(fileProblem({ name: 'Deck.PPTX', size: 1 }), null)
assert.equal(fileProblem({ name: 'Model.xlsx', size: 1 }), null)
assert.equal(fileProblem({ name: 'Plan.docx', size: 1 }), null)

// Stored paths: {pillar}/{email}/{doc_id}/{timestamp}-{name}; anything else is rejected.
assert.deepEqual(parsePath('vac/a@b.com/asg_1/1700000000000-Notes.pdf'), { pillar: 'vac', owner: 'a@b.com' })
assert.equal(parsePath('vac/a@b.com/../x.pdf'), null)
assert.equal(parsePath('admin/a@b.com/x/1-a.pdf'), null)
assert.equal(parsePath('vac/a@b.com/x'), null)
assert.equal(fileNameOf('vac/a@b.com/asg_1/1700000000000-Notes.pdf'), 'Notes.pdf')
assert.equal(fileHref('https://drive.google.com/x'), 'https://drive.google.com/x')
assert.equal(fileHref('vac/a@b.com/a/1-b.pdf'), '/api/files/view?path=vac%2Fa%40b.com%2Fa%2F1-b.pdf')
assert.ok(isLink('https://x.y') && !isLink('vac/a/b/c'))

assert.equal(quarterOf('2026-10-06'), 'Q4 2026')
assert.equal(quarterOf('2026-01-01'), 'Q1 2026')
assert.ok(periodKey('Q3 2026') < periodKey('Q1 2027'))
console.log('incubation logic: ok')
