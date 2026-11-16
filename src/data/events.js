import { registerCollection, getCollection } from './store.js'

// Fetched 2026-11-16 from each event's official page (refresh after the soonest date passes).
// `registerUrl` is what the "Register Now" button opens. `registered` / `seatsLeft` are null
// for these: the organisers don't publish counts, so the UI hides them. Sorted soonest first;
// recurring (startsAt: null) meetups follow.
const DEFAULT_EVENTS = [
  {
    slug: 'bengaluru-tech-summit-2026',
    name: 'Bengaluru Tech Summit 2026',
    type: 'Conference',
    dateLabel: '17–19 Nov 2026',
    time: '9:00 AM – 6:00 PM',
    startsAt: '2026-11-17T09:00:00+05:30',
    location: 'BIEC, Bengaluru',
    image:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://www.bengalurutechsummit.com/bts-2026-f6s/index.php',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'Asia’s largest integrated tech event — theme “AI & Beyond”.',
    description:
      'Bengaluru Tech Summit 2026 brings together global companies, startups, investors and policymakers around the theme “AI & Beyond”. Co-hosted with STPI and K-tech. Registration is via the F6S link.',
  },
  {
    slug: 'tiecon-delhi-ncr-2026',
    name: 'TiEcon Delhi-NCR 2026',
    type: 'Conference',
    dateLabel: '2–3 Dec 2026',
    time: 'See event page',
    startsAt: '2026-12-02T09:00:00+05:30',
    location: 'India Habitat Centre, New Delhi',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://events.tie.org/Delhi-NCR/tiecondelhincr',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'TiE Delhi-NCR’s two-day entrepreneurship conference: “Growth Engines of Tomorrow”.',
    description:
      'A two-day entrepreneurship conference by TiE Delhi-NCR bringing together founders, investors, corporates and policymakers, themed “Growth Engines of Tomorrow”.',
  },
  {
    slug: 'entrepreneurs-mixer-jaipur',
    name: 'Entrepreneur’s Mixer (Jaipur)',
    type: 'Networking',
    dateLabel: '5 Dec 2026',
    time: '5:00 PM – 6:00 PM',
    startsAt: '2026-12-05T17:00:00+05:30',
    location: 'Everest Colony, Lalkothi, Jaipur',
    image:
      'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://allevents.in/jaipur/entrepreneurs-mixer-jaipur-tickets/80003939663530',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'Peer-to-peer mixer for Jaipur founders and early-stage entrepreneurs (ticketed, ₹392).',
    description:
      'A curated networking mixer for founders and early-stage entrepreneurs in Jaipur — open networking and candid talk about building in a tier-2 city. Organised by Entrepreneurs Arch (per the AllEvents listing); venue: Pankaj Singhvi Marg, Everest Colony, Lalkothi, Jaipur.',
  },
  {
    slug: 'tie-global-summit-2026',
    name: 'TiE Global Summit 2026',
    type: 'Summit',
    dateLabel: '14–15 Dec 2026',
    time: 'See event page',
    startsAt: '2026-12-14T09:00:00+05:30',
    location: 'Brilliant Convention Centre, Indore',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://tieglobalsummit.org/registration/',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'A global conversation on entrepreneurship, innovation and human progress.',
    description:
      'TiE Global Summit 2026, hosted by TiE Indore with the Government of Madhya Pradesh as Host State Partner.',
  },
  {
    slug: 'bioasia-2027',
    name: 'BioAsia 2027',
    type: 'Conference',
    dateLabel: '15–17 Feb 2027',
    time: 'See event page',
    startsAt: '2027-02-15T09:00:00+05:30',
    location: 'HITEX, Hyderabad',
    image:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://bioasia.co.in/',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'Asia’s largest life sciences & health-tech convention, hosted by Telangana.',
    description:
      'BioAsia 2027 “Beyond Boundaries”, hosted by the Government of Telangana. Delegate and startup registration was “opening soon” as of 2026-11-16 — the link goes to the event page.',
  },
  {
    slug: 'startup-mahakumbh-6-2027',
    name: 'Startup Mahakumbh 6.0',
    type: 'Conference',
    dateLabel: '12–13 Mar 2027',
    time: 'See event page',
    startsAt: '2027-03-12T09:00:00+05:30',
    location: 'Bharat Mandapam, New Delhi',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://startupmahakumbh.co.in/delegate',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'Asia’s largest startup expo and conference for founders, investors and government.',
    description:
      'Startup Mahakumbh 6.0 at Bharat Mandapam, New Delhi, bringing together founders, investors, speakers and government officials.',
  },
  {
    slug: 'startup-dangal-3-2027',
    name: 'Startup Dangal 3.0',
    type: 'Summit',
    dateLabel: '12–13 Mar 2027',
    time: 'See event page',
    startsAt: '2027-03-12T09:00:00+05:30',
    location: 'Bharat Mandapam, New Delhi',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://startupdangal.com/application-process',
    registered: null,
    seatsLeft: null,
    completed: false,
    short: 'Startup pitch competition with funding up to ₹10 lakh.',
    description:
      'Startup Dangal 3.0 (AICRA): entrepreneurs pitch, get mentorship from industry experts and can win funding up to ₹10 lakh.',
  },
  {
    slug: 'startup-grind-jaipur',
    name: 'Startup Grind Jaipur',
    type: 'Networking',
    dateLabel: 'Monthly meetup',
    time: 'Evenings',
    startsAt: null, // recurring — no fixed date
    location: 'Jaipur',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://www.startupgrind.com/jaipur/',
    registered: 73,
    seatsLeft: 27,
    completed: false,
    short: 'The global Startup Grind community’s Jaipur chapter — fireside chats & networking.',
    description:
      'Startup Grind is a global community for entrepreneurs, and its Jaipur chapter runs regular fireside chats, founder stories and networking meetups to help local startups build, grow and scale. Join the chapter to get notified about the next session.',
    agenda: [
      { time: '06:00 PM', title: 'Doors open & intros' },
      { time: '06:30 PM', title: 'Fireside chat with a founder' },
      { time: '07:30 PM', title: 'Open networking' },
    ],
  },
  {
    slug: 'echai-founders-meetup-jaipur',
    name: 'eChai Founders Meetup — Jaipur',
    type: 'Networking',
    dateLabel: 'Recurring',
    time: 'Evenings',
    startsAt: null, // recurring — no fixed date
    location: 'J Startup House, Jaipur',
    image:
      'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=80',
    registerUrl: 'https://echai.ventures/cities/jaipur/events',
    registered: 58,
    seatsLeft: 22,
    completed: false,
    short: 'eChai Ventures’ candid founder meetups, demo days & pitch nights in Jaipur.',
    description:
      'eChai Ventures hosts startup stories, candid founder conversations, demo days and pitch nights in Jaipur — open to all founders, investors and product builders. Check the eChai Jaipur calendar for the next meetup and RSVP.',
    agenda: [
      { time: '05:30 PM', title: 'Founder check-ins' },
      { time: '06:00 PM', title: 'Candid founder conversations' },
      { time: '07:00 PM', title: 'Demo & pitch corner' },
    ],
  },
  {
    slug: 'bharat-renewable-expo-2027',
    name: 'Bharat Renewable Expo 2027',
    type: 'Conference',
    dateLabel: 'Jan 29–31, 2027',
    time: '09:00 AM – 6:00 PM',
    startsAt: '2027-01-29T09:00:00+05:30',
    location: 'JECC, Sitapura, Jaipur',
    image:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
    registerUrl:
      'https://allevents.in/jaipur/bharat-renewable-expo-2027-tickets/80001454798597',
    registered: 110,
    seatsLeft: 90,
    completed: false,
    short: 'A three-day clean-energy expo showcasing Rajasthan’s renewable push.',
    description:
      'Bharat Renewable Expo is an immersive three-day exhibition on the future of clean energy, unveiling Rajasthan’s pioneering efforts in solar, storage and green tech — a strong stage for climate and energy startups. Free to attend.',
    agenda: [
      { time: '09:00 AM', title: 'Expo floor opens' },
      { time: '11:00 AM', title: 'Clean-energy keynotes' },
      { time: '02:00 PM', title: 'Startup & innovation pavilion' },
      { time: '05:00 PM', title: 'Networking' },
    ],
  },
]

// Active list = admin override (localStorage) or the defaults above.
export const EVENTS = registerCollection('events', DEFAULT_EVENTS)

// Fresh read for pages so admin edits show on navigation.
export const getEvents = () => getCollection('events')

// Filter pill → predicate. Only types that actually exist in EVENTS are shown.
export const EVENT_FILTERS = [
  'All',
  'Upcoming',
  'Investor Summits',
  'Conferences',
  'Networking',
]

export const FILTER_TYPE = {
  'Investor Summits': 'Summit',
  Conferences: 'Conference',
  Networking: 'Networking',
}

export const TYPE_STYLES = {
  Summit: 'bg-orange text-white',
  Conference: 'bg-ink text-white',
  Networking: 'bg-sky-600 text-white',
}

export const LOW_SEATS = 15

export function getEvent(slug) {
  return getEvents().find((e) => e.slug === slug)
}

// Soonest upcoming event that has a concrete start time (skips recurring ones).
export function getNextEvent(now = Date.now()) {
  return (
    getEvents()
      .filter((e) => e.startsAt && new Date(e.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null
  )
}
