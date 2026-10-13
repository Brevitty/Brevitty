// Hub Admin > Content: add / edit / remove the team-curated reference rows (competitions, schemes,
// journey templates, cohort sessions, VAC classes). Fields and rules come from the API
// (api/_lib/contentAdmin.js), so this screen never hardcodes a column.
import { useState } from 'react'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost, formatDate } from '../../lib/hubApi.js'
import { Page, ViewHeader, Card, CardHead, Field, SaveNote, EmptyNote, Pill, LoadingView, ErrorView, inputClass, primaryButton, ghostButton } from '../hub/ui.jsx'

const blankRow = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.type === 'bool' ? 'TRUE' : '']))

function FieldInput({ field, value, onChange, disabled }) {
  const id = `content-${field.name}`
  const common = { id, disabled, required: field.required, className: inputClass }
  if (field.type === 'bool') {
    return (
      <label className="flex min-h-[44px] items-center gap-2.5 text-sm font-semibold text-ink">
        <input type="checkbox" checked={value === 'TRUE'} disabled={disabled} onChange={(e) => onChange(e.target.checked ? 'TRUE' : '')} className="h-4 w-4 accent-orange" />
        {field.label}
      </label>
    )
  }
  let input
  if (field.type === 'long' || field.type === 'lines') input = <textarea {...common} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
  else if (field.type === 'select') {
    input = (
      <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  } else {
    const type = { url: 'url', date: 'date', email: 'email' }[field.type] || 'text'
    input = <input {...common} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <Field label={`${field.label}${field.required ? '' : ' (optional)'}`} htmlFor={id}>
      {input}
    </Field>
  )
}

function ContentForm({ config, initial, editingKey, onSaved, onCancel }) {
  const [row, setRow] = useState(initial)
  const [state, setState] = useState(null)
  const fields = editingKey ? config.fields.filter((f) => f.name !== config.key) : config.fields

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      onSaved(await hubPost('admin/content', { tab: config.id, key: editingKey || undefined, row }))
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <Card className="mt-6 !border-orange/30">
      <CardHead title={editingKey ? `Edit: ${initial[config.titleField] || editingKey}` : `Add to ${config.title}`} />
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.type === 'long' || f.type === 'lines' ? 'sm:col-span-2' : ''}>
            <FieldInput field={f} value={row[f.name] ?? ''} disabled={state?.saving} onChange={(v) => setRow((r) => ({ ...r, [f.name]: v }))} />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={state?.saving} className={primaryButton}>
            {state?.saving ? 'Saving…' : editingKey ? 'Save changes' : 'Add'}
          </button>
          <button type="button" onClick={onCancel} disabled={state?.saving} className={ghostButton}>
            Cancel
          </button>
          <SaveNote state={state?.error ? { error: state.error } : null} />
        </div>
      </form>
    </Card>
  )
}

// A short secondary line for each row: the first couple of filled fields after the title.
function summaryOf(config, row) {
  return config.fields
    .filter((f) => f.name !== config.titleField && !['bool', 'long', 'lines'].includes(f.type) && row[f.name])
    .slice(0, 3)
    .map((f) => (f.type === 'date' ? formatDate(row[f.name]) : f.type === 'select' ? f.options.find((o) => o.value === row[f.name])?.label : row[f.name]))
    .join(' · ')
}

function ContentRow({ config, row, onEdit, onDeleted }) {
  const [confirm, setConfirm] = useState(false)
  const [state, setState] = useState(null)
  const key = row[config.key]
  const titleField = config.fields.find((f) => f.name === config.titleField)
  const title = titleField?.type === 'select' ? titleField.options.find((o) => o.value === row[config.titleField])?.label || key : row[config.titleField] || key
  const active = config.fields.some((f) => f.name === 'active') ? row.active === 'TRUE' : null

  async function remove() {
    setState({ saving: true })
    try {
      onDeleted(await hubPost('admin/content/delete', { tab: config.id, key }))
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">
            {title} {active !== null && <Pill tone={active ? 'done' : 'neutral'}>{active ? 'Active' : 'Hidden'}</Pill>}
          </p>
          <p className="mt-0.5 break-words text-xs text-black/50">{summaryOf(config, row) || '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {confirm ? (
            <>
              <button type="button" disabled={state?.saving} onClick={remove} className={`${ghostButton} !border-red-400 !text-red-600`}>
                {state?.saving ? 'Removing…' : 'Confirm remove'}
              </button>
              <button type="button" disabled={state?.saving} onClick={() => setConfirm(false)} className={ghostButton}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onEdit(row)} aria-label={`Edit ${title}`} className={ghostButton}>
                Edit
              </button>
              <button type="button" onClick={() => setConfirm(true)} aria-label={`Remove ${title}`} className={ghostButton}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      <SaveNote state={state?.error ? { error: state.error } : null} />
    </div>
  )
}

export function ContentView({ onUnauthorized }) {
  const [tab, setTab] = useState('Competitions')
  const load = useJunctionFetch(`/api/hub/admin/content?tab=${encodeURIComponent(tab)}`, onUnauthorized)
  const [form, setForm] = useState(null) // { initial, key } while adding / editing
  if (load.loading && !load.data) return <LoadingView label="Loading content…" />
  if (load.error && !load.data) return <ErrorView message={load.error} onRetry={load.refetch} />

  const { tabs, rows } = load.data
  const config = tabs.find((t) => t.id === load.data.tab)
  const applied = (data) => {
    load.setData(data)
    setForm(null)
  }
  const pick = (id) => {
    setForm(null)
    setTab(id)
  }

  return (
    <Page>
      <ViewHeader eyebrow="Content" title="Reference content." subtitle="Everything members see that the Hub team curates. Changes go live on the next page load." />
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Content type">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => pick(t.id)}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition-colors ${t.id === tab ? 'border-ink bg-ink text-white dark:border-white/20' : 'border-black/15 text-black/60 hover:text-ink'}`}
          >
            {t.title}
          </button>
        ))}
      </div>
      {config && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-black/55">{config.note}</p>
            {!form && (
              <button type="button" onClick={() => setForm({ initial: blankRow(config.fields), key: '' })} className={primaryButton}>
                Add
              </button>
            )}
          </div>
          {form && <ContentForm key={form.key || 'new'} config={config} initial={form.initial} editingKey={form.key} onSaved={applied} onCancel={() => setForm(null)} />}
          <div className="mt-6 flex flex-col gap-3">
            {load.loading ? (
              <EmptyNote>Loading…</EmptyNote>
            ) : rows.length ? (
              rows.map((r) => <ContentRow key={r[config.key]} config={config} row={r} onEdit={(row) => setForm({ initial: row, key: row[config.key] })} onDeleted={applied} />)
            ) : (
              <EmptyNote>Nothing here yet. Use Add to create the first entry.</EmptyNote>
            )}
          </div>
        </>
      )}
    </Page>
  )
}
