import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import RegisterShell, { primaryButton } from '../../components/register/RegisterShell.jsx'
import { REGISTRATION_OPTIONS, OPTION_ORDER, OPTION_ROUTES } from '../../data/registrationOptions.js'

const ease = [0.22, 1, 0.36, 1]

// /register is only the menu: no form here. Each card opens that option's own complete form.
export default function RegisterPage() {
  const reduce = useReducedMotion()
  return (
    <RegisterShell wide title="Register with Brevitty" intro="Choose what you'd like to join. You can register for more than one.">
      <ul className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
        {OPTION_ORDER.map((id, i) => {
          const opt = REGISTRATION_OPTIONS[id]
          return (
            <motion.li
              key={id}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: i * 0.06 }}
              className="flex flex-col rounded-2xl border border-black/10 bg-white p-6 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.25)]"
            >
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">{opt.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-black/60">{opt.description}</p>
              <Link to={OPTION_ROUTES[id]} className={`${primaryButton} mt-5 w-full`} aria-label={`Register for ${opt.title}`}>
                Register
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </RegisterShell>
  )
}
