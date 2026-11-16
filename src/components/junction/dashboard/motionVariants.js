// Shared Framer Motion constants for the signed-in Startup Junction dashboard,
// so every view/sidebar animates with the same ease curve and stagger rhythm.

export const ease = [0.22, 1, 0.36, 1]

export const viewContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const viewItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}
