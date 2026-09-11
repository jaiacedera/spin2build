export function typePhrase(type: string): string {
  const name = type.toLowerCase()
  const article = /^(ai |iot |api)/.test(name) ? 'an' : 'a'
  return `${article} ${name}`
}

const templates = [
  (type: string, topic: string) => `Build ${type} that helps people discover and organize ${topic} content. Include a searchable library, personal collections, and a weekly digest of new finds.`,
  (type: string, topic: string) => `Create ${type} for people interested in ${topic}. Let users save favorites, share curated lists, and find recommendations based on their interests.`,
  (type: string, topic: string) => `Design ${type} that makes ${topic} activities easier to manage. Start with a simple planner, progress tracking, and a clear overview of what to do next.`,
  (type: string, topic: string) => `Build ${type} that brings the ${topic} community together. Add a space to share resources, ask questions, and discover projects from other enthusiasts.`,
  (type: string, topic: string) => `Create ${type} that turns learning about ${topic} into a daily practice. Offer bite-sized challenges, a personal journal, and milestones to celebrate progress.`,
]

export function createIdea(type: string, topic: string, previous: string): string {
  const choices = templates.map(template => template(typePhrase(type), topic.toLowerCase())).filter(idea => idea !== previous)
  return choices[Math.floor(Math.random() * choices.length)] ?? ''
}
