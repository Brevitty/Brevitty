// Mentors for "The Room". `photo` is optional — when absent, an initials
// avatar on the gradient is shown. Drop an image path in later to use a real photo.
export const MENTORS = [
  {
    name: 'CA Paresh Gupta',
    title: 'Founder GCEC',
    role: 'Founder',
    company: 'GCEC',
    bio: 'Chartered Accountant, SRCC Alumni, Start-up Mentor and Investor, Rajasthan Youth Icon, 8 Times TEDx Speaker, Shiksha Bharti Award',
    gradient: ['#f97316', '#db2777'],
    photo: "https://www.gcecglobal.com/wp-content/uploads/2025/12/Paresh-1-1.jpg",
  },
  {
    name: 'Dr Saarthak Bakshi',
    title: 'Founder & CEO Risaa IVF',
    role: 'CEO',
    company: 'Risaa IVF',
    bio: " Founder & CEO of Risaa IVF, Recognized as part of Forbes 30 U 30 Asia, BW 40 U 40 Awards,invested in over 30 startups across sectors such as healthtech, edtech, consumer brands, and social impact, supporting founders with both capital and strategic guidance to scale impactful solutions.",
    gradient: ['#6366f1', '#0ea5e9'],
    photo: "sarthaakBhakshi.png",
  },
  {
    name: 'Akshay Kedia',
    title: 'Founder & CMO - Nothing Before Coffee',
    role: 'Founder & CMO',
    company: '- Nothing Before coffee',
    bio: 'Founder & CMO Nothing Before coffee, Entrepreneur for 14 years, Specialist in Branding, Design and Advertising, Serial Investor',
    gradient: ['#16a34a', '#0ea5e9'],
    photo: "akshayKedia.png",
  },
  {
    name: 'Mr. Tushar Saini',
    title: 'Founder CUET Pro',
    role: 'Founder',
    company: 'CUET Pro',
    bio: "Bootstrapped Finly to a $60M exit. Now angel-investing across fintech and developer tools",
    gradient: ['#6366f1', '#0ea5e9'],
    photo: "https://www.gcecglobal.com/wp-content/uploads/2026/03/Untitled-design.png",
  },
  {
    name: 'Mr. Anuj Jain',
    title: 'Co-Founder - Startup O',
    role: 'Co-Founder',
    company: 'Startup O',
    bio: "Deep-tech venture creation, Ecosystem design (bridging academia, capital, and industry), Commercialisation strategy (turning research into revenue), Buisness Strategist - Billion Bricks",
    gradient: ['#9333ea', '#6366f1'],
    photo: "anujJain.png",
  },
]

// Desktop floating-board positions (% of board) + per-card parallax + base tilt.
export const MENTOR_LAYOUT = [
  { top: '6%', left: '4%', rotate: -5, parallax: 1.1, z: 20 },
  { top: '0%', left: '36%', rotate: 3, parallax: -0.7, z: 30 },
  { top: '12%', left: '69%', rotate: 6, parallax: 0.9, z: 20 },
  { top: '48%', left: '15%', rotate: 4, parallax: -1.2, z: 25 },
  { top: '54%', left: '45%', rotate: -4, parallax: 0.7, z: 15 },
]
