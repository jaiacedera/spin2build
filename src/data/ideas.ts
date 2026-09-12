export function typePhrase(type: string): string {
  const name = type.toLowerCase()
  const article = /^(ai |iot |api)/.test(name) ? 'an' : 'a'
  return `${article} ${name}`
}

const concepts = [
  (type: string, topic: string) => `Build ${type} that turns scattered ${topic} resources into a searchable personal discovery library.`,
  (type: string, topic: string) => `Create ${type} for sharing curated ${topic} lists and discovering recommendations based on personal interests.`,
  (type: string, topic: string) => `Design ${type} that turns ${topic} goals into manageable weekly plans with visible progress.`,
  (type: string, topic: string) => `Build ${type} where the ${topic} community can exchange resources, ask questions, and showcase projects.`,
  (type: string, topic: string) => `Create ${type} that turns learning about ${topic} into a daily practice of small missions and personal milestones.`,
]

export interface Direction {
  id: string
  variant: number
  projectType: string
  topic: string
  concept: string
  audience: string
  coreLoop: string
  features: string[]
  techStack: string[]
  extraChallenge: string
}

const details = [
  { audience: 'Enthusiasts and researchers who want to organize their discoveries', coreLoop: 'Discover a resource → save it → organize a collection → revisit a favorite.', features: ['Searchable resource library', 'Personal collections and tags', 'Notes on saved resources', 'Weekly discovery digest', 'Duplicate detection'], extraChallenge: 'Suggest unexpected connections between saved resources and explain why they belong together.' },
  { audience: 'Curious newcomers and experienced enthusiasts who enjoy sharing their best finds', coreLoop: 'Choose an interest → explore a list → save a recommendation → share your own.', features: ['Interest selection', 'Curated recommendation lists', 'Saved favorites', 'Shareable list links', 'Recommendation feedback'], extraChallenge: 'Balance familiar recommendations with discoveries outside the user’s usual interests.' },
  { audience: 'Busy beginners and independent learners looking for a consistent routine', coreLoop: 'Set a goal → plan a small step → complete it → review weekly progress.', features: ['Personal goal creation', 'Weekly planner', 'Progress tracking', 'Optional reminders', 'Weekly reflection notes'], extraChallenge: 'Adapt next week’s plan to the user’s actual pace without penalizing missed days.' },
  { audience: 'Hobbyists and makers looking for feedback and a community', coreLoop: 'Share a resource → ask a question → exchange feedback → discover a project.', features: ['Community resource board', 'Interest profiles', 'Question threads', 'Project showcase', 'Saved discussions'], extraChallenge: 'Match members by complementary interests and explain what they could learn from each other.' },
  { audience: 'Students and self-directed learners who prefer hands-on practice', coreLoop: 'Choose a mission → complete a task → record progress → unlock the next challenge.', features: ['Daily missions', 'Task creation', 'Personal progress milestones', 'Practice journal', 'Adjustable difficulty'], extraChallenge: 'Adjust mission difficulty using the user’s recent progress and confidence ratings.' },
]

const stacks: Record<string, string[]> = {
  'Mobile App': ['Expo', 'React Native', 'TypeScript', 'SQLite'],
  'Desktop App': ['Tauri', 'Vue 3', 'TypeScript', 'SQLite'],
  'Browser Extension': ['WebExtensions API', 'Vue 3', 'TypeScript', 'Browser Storage'],
  'Game': ['Phaser', 'TypeScript', 'Vite', 'IndexedDB'],
  'AI Tool': ['Vue 3', 'TypeScript', 'OpenAI API', 'Node.js', 'PostgreSQL'],
  'IoT System': ['MicroPython', 'MQTT', 'Node.js', 'Vue 3'],
  'API / Backend': ['Node.js', 'TypeScript', 'Fastify', 'PostgreSQL'],
  'CLI Tool': ['Node.js', 'TypeScript', 'Commander', 'SQLite'],
  'PWA': ['Vue 3', 'TypeScript', 'Vite PWA', 'IndexedDB'],
}

export function createIdea(type: string, topic: string, previous: Direction | null): Direction {
  const choices = concepts.map((_, index) => index).filter(index => index !== previous?.variant)
  const variant = choices[Math.floor(Math.random() * choices.length)] ?? 0
  const detail = details[variant]!
  return {
    id: crypto.randomUUID(), variant, projectType: type, topic,
    ...detail, features: [...detail.features],
    concept: concepts[variant]!(typePhrase(type), topic.toLowerCase()),
    audience: `${detail.audience} in ${topic.toLowerCase()}.`,
    techStack: [...(stacks[type] ?? ['Vue 3', 'TypeScript', 'Vite', 'Supabase'])],
  }
}
