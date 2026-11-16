import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import { ChromeVisibilityProvider } from './context/ChromeVisibilityContext.jsx'
import HomePage from './pages/HomePage.jsx'
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'))
const CommunityPage = lazy(() => import('./pages/CommunityPage.jsx'))
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'))
const EventDetailPage = lazy(() => import('./pages/EventDetailPage.jsx'))
const LaunchpadMentorPage = lazy(() => import('./pages/LaunchpadMentorPage.jsx'))
const MentorsPage = lazy(() => import('./pages/MentorsPage.jsx'))
const MentorProfilePage = lazy(() => import('./pages/MentorProfilePage.jsx'))
const PartnersPage = lazy(() => import('./pages/PartnersPage.jsx'))
const GrantsPage = lazy(() => import('./pages/GrantsPage.jsx'))
const SpacePage = lazy(() => import('./pages/SpacePage.jsx'))
const StartupJunctionPage = lazy(() => import('./pages/StartupJunctionPage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))
const ConsultingPage = lazy(() => import('./pages/ConsultingPage.jsx'))
const SignInPage = lazy(() => import('./pages/SignInPage.jsx'))
// Public registration flow (no auth gate, normal site chrome)
const RegisterPage = lazy(() => import('./pages/register/RegisterPage.jsx'))
const RegisterGrantsPage = lazy(() => import('./pages/register/RegisterGrantsPage.jsx'))
const RegisterStartupJunctionPage = lazy(() => import('./pages/register/RegisterStartupJunctionPage.jsx'))
const RegisterStartupArenaPage = lazy(() => import('./pages/register/RegisterStartupArenaPage.jsx'))
const RegisterMentorshipPage = lazy(() => import('./pages/register/RegisterMentorshipPage.jsx'))
const HubGate = lazy(() => import('./pages/hub/HubGate.jsx'))
const HubIndexPage = lazy(() => import('./pages/hub/HubIndexPage.jsx'))
const HubChoosePage = lazy(() => import('./pages/hub/HubChoosePage.jsx'))
const HubStatusPage = lazy(() => import('./pages/hub/HubStatusPage.jsx'))
const HubNonePage = lazy(() => import('./pages/hub/HubNonePage.jsx'))
const ConsultingAdminPage = lazy(() => import('./pages/hub/ConsultingAdminPage.jsx'))
const WorkspacePage = lazy(() => import('./pages/hub/WorkspacePage.jsx'))

export default function App() {
  // The admin dashboard is a standalone tool — no site nav/footer, and it's
  // intentionally not linked anywhere. Reach it only via the /admin URL.
  const isAdmin = useLocation().pathname.startsWith('/admin')
  // The signed-in Startup Junction dashboard is also a standalone app shell
  // (its own sidebar nav); it reports this itself via useHideSiteChrome so the
  // signed-out auth gate on the same route keeps the normal site chrome.
  const [chromeHiddenByPage, setChromeHiddenByPage] = useState(false)
  const hideChrome = isAdmin || chromeHiddenByPage

  return (
    <ChromeVisibilityProvider value={setChromeHiddenByPage}>
      <div className="relative min-h-screen bg-white">
        <ScrollToTop />
        {!hideChrome && <Navbar />}
        {/* Each page is its own chunk: the marketing site never downloads the Hub, and vice versa. */}
        <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:slug" element={<EventDetailPage />} />
          <Route path="/mentors" element={<MentorsPage />} />
          <Route path="/mentors/:slug" element={<MentorProfilePage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/grants" element={<GrantsPage />} />
          <Route path="/space" element={<SpacePage />} />
          <Route path="/startup-junction" element={<StartupJunctionPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Consulting workspace: own auth + role gate; hides site chrome itself */}
          <Route path="/consulting/*" element={<ConsultingPage />} />
          <Route path="/signin" element={<SignInPage />} />
          {/* Public registration: outside HubGate on purpose; each step guards itself via sessionStorage */}
          <Route path="/register" element={<RegisterPage />} />
          {/* The old multi-step flow no longer exists: send any bookmarked step to the options page. */}
          <Route path="/register/details" element={<Navigate to="/register" replace />} />
          <Route path="/register/student" element={<Navigate to="/register" replace />} />
          <Route path="/register/open" element={<Navigate to="/register" replace />} />
          <Route path="/register/startup-junction" element={<RegisterStartupJunctionPage />} />
          <Route path="/register/startup-arena" element={<RegisterStartupArenaPage />} />
          <Route path="/register/mentorship" element={<RegisterMentorshipPage />} />
          <Route path="/register/grants" element={<RegisterGrantsPage />} />
          {/* /hub/* : HubGate sends signed-out visitors to /signin?next=...; workspaces also check access server-side */}
          <Route path="/hub" element={<HubGate />}>
            <Route index element={<HubIndexPage />} />
            <Route path="choose" element={<HubChoosePage />} />
            <Route path="status" element={<HubStatusPage />} />
            <Route path="none" element={<HubNonePage />} />
            <Route path="consulting-admin/*" element={<ConsultingAdminPage />} />
            <Route path=":pillar" element={<WorkspacePage />} />
          </Route>
          {/* Launchpad Abroad mentor view: same Hub session; LP_Mentors decides access (server-side) */}
          <Route path="/launchpad/mentor" element={<HubGate />}>
            <Route index element={<LaunchpadMentorPage />} />
          </Route>
        </Routes>
        </Suspense>
        {!hideChrome && <Footer />}
      </div>
    </ChromeVisibilityProvider>
  )
}
