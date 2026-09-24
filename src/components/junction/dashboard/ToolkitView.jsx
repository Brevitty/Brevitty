import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOOLS, TAG_LABEL } from '../../../data/junctionTools.js'
import ToolDetailView from '../ToolDetailView.jsx'
import { viewContainer, viewItem } from './motionVariants.js'

function ToolCard({ tool, onSelect }) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(tool)}
      variants={viewItem}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col rounded-2xl border border-black/10 bg-surface p-6 text-left transition-colors duration-300 hover:border-orange/60 hover:shadow-[0_28px_56px_-26px_rgba(249,115,22,0.35)]"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-black/30 transition-colors group-hover:text-orange">
          [{tool.num}]
        </span>
        <span className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-black/50">
          {TAG_LABEL[tool.kind]}
        </span>
      </div>

      <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-ink">{tool.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-black/55">{tool.tagline}</p>

      <span className="mt-6 inline-flex translate-y-1 items-center gap-1.5 text-sm font-semibold text-orange opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        Open tool
        <span>→</span>
      </span>
    </motion.button>
  )
}

// Owns its own selected-tool state: picking a tool swaps this view's grid for
// the detail view in place, without affecting any other sidebar section.
export default function ToolkitView({ onUnauthorized }) {
  const [tool, setTool] = useState(null)

  return (
    <AnimatePresence mode="wait">
      {tool ? (
        <ToolDetailView key={tool.id} tool={tool} onBack={() => setTool(null)} onUnauthorized={onUnauthorized} />
      ) : (
        <motion.div
          key="grid"
          variants={viewContainer}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0 }}
          className="p-6 lg:p-10"
        >
          <motion.p variants={viewItem} className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">
            The toolkit
          </motion.p>
          <motion.h2 variants={viewItem} className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Six advisors. One founder’s journey.
          </motion.h2>
          <motion.p variants={viewItem} className="mt-4 max-w-2xl text-base text-black/55">
            Each tool runs a real Startup Junction skill — tuned for student founders, one form in, structured guidance out.
          </motion.p>

          <motion.div variants={viewContainer} className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {TOOLS.map((t) => (
              <ToolCard key={t.id} tool={t} onSelect={setTool} />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
