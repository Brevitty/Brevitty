import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import { ChromeVisibilityProvider } from './context/ChromeVisibilityContext.jsx'
import HomePage from './pages/HomePage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import CommunityPage from './pages/CommunityPage.jsx'
import EventsPage from './pages/EventsPage.jsx'
import EventDetailPage from './pages/EventDetailPage.jsx'
import MentorsPage from './pages/MentorsPage.jsx'
import MentorProfilePage from './pages/MentorProfilePage.jsx'
import PartnersPage from './pages/PartnersPage.jsx'
import GrantsPage from './pages/GrantsPage.jsx'
import SpacePage from './pages/SpacePage.jsx'
import StartupJunctionPage from './pages/StartupJunctionPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ConsultingPage from './pages/ConsultingPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import HubGate from './pages/hub/HubGate.jsx'
import HubIndexPage from './pages/hub/HubIndexPage.jsx'
import HubChoosePage from './pages/hub/HubChoosePage.jsx'
import HubStatusPage from './pages/hub/HubStatusPage.jsx'
import HubNonePage from './pages/hub/HubNonePage.jsx'
import WorkspacePage from './pages/hub/WorkspacePage.jsx'
import LaunchpadMentorPage from './pages/LaunchpadMentorPage.jsx'

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
          {/* /hub/* : HubGate sends signed-out visitors to /signin?next=...; workspaces also check access server-side */}
          <Route path="/hub" element={<HubGate />}>
            <Route index element={<HubIndexPage />} />
            <Route path="choose" element={<HubChoosePage />} />
            <Route path="status" element={<HubStatusPage />} />
            <Route path="none" element={<HubNonePage />} />
            <Route path=":pillar" element={<WorkspacePage />} />
          </Route>
          {/* Launchpad Abroad mentor view: same Hub session; LP_Mentors decides access (server-side) */}
          <Route path="/launchpad/mentor" element={<HubGate />}>
            <Route index element={<LaunchpadMentorPage />} />
          </Route>
        </Routes>
        {!hideChrome && <Footer />}
      </div>
    </ChromeVisibilityProvider>
  )
}
