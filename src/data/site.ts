// Everything on the page that is a fact about Jérémy lives here.
// Items marked TODO come from the GitHub README only; replace with real details/links.

export const site = {
  handle: 'Swaiku',
  name: 'Jérémy',
  base: 'Fribourg, CH',
  timezone: 'Europe/Zurich',
  tagline:
    'I build machine-learning systems, autonomous robots and the infrastructure that keeps them running.',
  github: 'https://github.com/swaiku',
  // TODO: add real contact channels. Only non-empty values are rendered.
  email: '',
  linkedin: '',
  // TODO: confirm wording / availability.
  status: 'Open to internships and collaborations',
};

export const flightPlan = [
  { phase: 'done', title: 'Bachelor in Data Engineering', where: 'HEIA-FR' },
  { phase: 'alumni', title: 'Eurobot robotics competitions', where: 'robotics team' },
  { phase: 'now', title: 'Master in Data Science', where: 'HES-SO Fribourg' },
];

export const payload = [
  { module: 'Languages', items: ['Python', 'C++', 'TypeScript', 'JavaScript', 'Go'] },
  { module: 'Systems', items: ['ROS', 'Raspberry Pi', 'Linux', 'Git', 'GitHub', 'GitLab'] },
  { module: 'Data / ML', items: ['PyTorch', 'scikit-learn', 'MySQL', 'Docker'] },
  { module: 'Web', items: ['Astro', 'Svelte', 'Tailwind', 'Bun', 'Godot', 'Obsidian'] },
];

// TODO: replace descriptions and tags with real project details and links.
export const missions = [
  {
    name: 'Master in Data Science',
    where: 'HES-SO Fribourg',
    brief: 'Specialising in MLOps and cloud systems.',
    tags: ['MLOps', 'Cloud systems'],
  },
  {
    name: 'UAV autonomous navigation',
    where: 'Research',
    brief: 'Getting drones to find their own way.',
    tags: ['ROS', 'C++', 'Python'],
  },
  {
    name: 'Homelab',
    where: 'Self-hosted',
    brief: 'Raspberry Pi 5 running my own services, my ground station.',
    tags: ['Raspberry Pi 5', 'Linux', 'Docker'],
  },
  {
    name: 'Archery club website',
    where: 'Club',
    brief: 'Website and media for my archery club.',
    tags: ['Astro', 'Svelte', 'Tailwind'],
  },
];

export const offDuty = [
  { k: 'Archery', v: 'Club member, and the one behind its website and media.' },
  { k: 'Running', v: 'Endurance training, one long run at a time.' },
  { k: 'Formula 1', v: 'Race weekends are blocked in the calendar.' },
  { k: 'Gaming', v: 'Which is how Godot ended up in the stack.' },
  { k: 'Space exploration', v: 'The reason this page looks the way it does.' },
  { k: 'Privacy and open source', v: 'Self-hosting by default.' },
];
