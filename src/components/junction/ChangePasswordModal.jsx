import { useState } from 'react'
import { motion } from 'framer-motion'

const ease = [0.22, 1, 0.36, 1]
const MIN_PASSWORD = 8
const MAX_PASSWORD = 100
const CLOSE_DELAY_MS = 1200

const labelCls =
  'block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45'
const inputCls =
  'mt-1.5 w-full rounded-xl border border-black/15 bg-surface px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-orange'

export default function ChangePasswordModal({ onClose, onExpired }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (loading || done) return
    if (next.length < MIN_PASSWORD || next.length > MAX_PASSWORD) {
      return setError(`New password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters.`)
    }
    if (next !== confirm) return setError('New passwords don’t match.')

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (res.status === 401) return onExpired()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'Something went wrong. Please try again.')
      setDone(true)
      setTimeout(onClose, CLOSE_DELAY_MS)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#000000]/40 px-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        className="w-full max-w-sm rounded-3xl border border-black/10 bg-surface p-8 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)]"
      >
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Change password
        </h2>

        <label htmlFor="cp-current" className={`mt-6 ${labelCls}`}>Current password</label>
        <input
          id="cp-current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={inputCls}
        />

        <label htmlFor="cp-new" className={`mt-4 ${labelCls}`}>New password</label>
        <input
          id="cp-new"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />

        <label htmlFor="cp-confirm" className={`mt-4 ${labelCls}`}>Confirm new password</label>
        <input
          id="cp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />

        {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
        {done && <p className="mt-3 text-sm font-medium text-orange">Password updated.</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-black/15 bg-surface/60 py-3 text-sm font-semibold text-ink transition-colors hover:border-black/30 hover:bg-surface"
          >
            Cancel
          </button>
          <motion.button
            type="submit"
            disabled={loading || done}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 rounded-full bg-orange py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-12px_rgba(249,115,22,0.7)] disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Update'}
          </motion.button>
        </div>
      </motion.form>
    </div>
  )
}
