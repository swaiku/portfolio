// Everything on the page that is a fact about Jérémy lives here (source: his CV and public GitHub repos).

export const site = {
  handle: 'Swaiku',
  name: 'Jérémy',
  base: 'Fribourg, CH',
  timezone: 'Europe/Zurich',
  tagline:
    'I build machine-learning systems, autonomous robots and the infrastructure that keeps them running.',
  github: 'https://github.com/swaiku',
  email: 'prin.jeremy@protonmail.ch',
  linkedin: 'https://www.linkedin.com/in/prinjeremy',
  // TODO: confirm wording / availability.
  status: 'Open to work',
};

export const flightPlan = [
  { phase: 'now', title: 'Master in Data Science', where: 'HES-SO Fribourg and Lausanne' },
  { phase: 'done', title: 'Bachelor in Data Engineering', where: 'HEIA-FR' },
  { phase: 'done', title: 'Software engineer, motor control', where: 'V Advanced Technology, summer 2025' },
  { phase: 'alumni', title: 'Eurobot robotics competition', where: '2nd nationally in 2025' },
  { phase: 'done', title: 'Developer internship', where: 'Ethos Engineering, Dublin, 2023' },
  { phase: 'done', title: 'IT apprenticeship (CFC)', where: 'École des Métiers de Fribourg, 2019-2023' },
];

export const payload = [
  { module: 'Languages', items: ['Python', 'C++', 'Go', 'TypeScript', 'JavaScript'] },
  { module: 'Robotics', items: ['ROS 2', 'Nav2', 'py_trees', 'Gazebo', 'PX4', 'ArduPilot', 'MQTT'] },
  { module: 'Systems', items: ['Raspberry Pi', 'Linux', 'Git', 'GitHub', 'GitLab'] },
  { module: 'Data / ML', items: ['PyTorch', 'scikit-learn', 'MySQL', 'Docker', 'Microsoft Fabric'] },
  { module: 'Web', items: ['Astro', 'Svelte', 'Tailwind', 'Bun', 'Godot', 'Obsidian'] },
];

export const missions: { name: string; where: string; brief: string; tags: string[]; href?: string }[] = [
  {
    name: 'Bachelor thesis: GPS-denied UAV navigation',
    where: 'HES-SO, 2026',
    brief:
      'Feature-aware trajectory planning that keeps a drone over landmark-rich ground, so visual localisation stays reliable without GPS.',
    tags: ['Python', 'SuperPoint', 'PX4', 'QGroundControl', 'WildNav'],
  },
  {
    name: 'Eurobot',
    where: 'Robotics team, 2025 to now',
    brief:
      'First season in 2025: 2nd nationally and 6th in the international qualifications. I rebuilt the control system: Nav2 navigation, py_trees match strategy and the actuators (Dynamixel servos, linear actuators).',
    tags: ['ROS 2', 'Nav2', 'py_trees', 'Gazebo', 'C++'],
  },
  {
    name: 'HES-SO at Paléo',
    where: 'Festival outreach, 2024-2026',
    brief:
      'Running the HES-SO stand for three editions: solar protection in 2024, chronic pain and electrostimulators in 2025, Chladni figures in 2026.',
    tags: ['Outreach', 'Science communication'],
  },
  {
    name: 'This portfolio',
    where: 'Open source, 2026',
    brief: 'The site you are on: a procedural planet generated live on the GPU, with its own Atlas of collectable worlds.',
    tags: ['Astro', 'Svelte', 'Three.js', 'TSL'],
    href: 'https://github.com/swaiku/portfolio',
  },
  {
    name: 'Pigeon Finder',
    where: 'Open source',
    brief: 'A game about catching pigeons.',
    tags: [],
    href: 'https://github.com/swaiku/pigeon-finder',
  },
  {
    name: 'Homelab',
    where: 'Self-hosted',
    brief: 'Raspberry Pi 5 running my own services, my ground station.',
    tags: ['Raspberry Pi 5', 'Linux', 'Docker'],
  },
  {
    name: 'Archery club website',
    where: 'Club Les Ours Blancs',
    brief: 'Website and media for my archery club, where I run communications.',
    tags: ['Astro', 'Svelte', 'Tailwind'],
  },
];

export const offDuty = [
  { k: 'Archery', v: 'Club member, and the one behind its website and media.' },
  { k: 'Volunteering', v: 'Secretary of the youth association Jeunesse Montet-Frasses.' },
  { k: 'Running', v: 'Endurance training, one long run at a time.' },
  { k: 'Linux', v: 'On the desk and on the homelab, and I like to know how it works.' },
  { k: 'Gaming', v: 'Which is how Godot ended up in the stack.' },
  { k: 'Space exploration', v: 'The reason this page looks the way it does.' },
  { k: 'Privacy and open source', v: 'Self-hosting by default.' },
];
