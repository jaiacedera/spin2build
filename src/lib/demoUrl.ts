export function normalizeDemoUrl(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Enter a Live Demo URL using https:// without a username or password.')
  }
  return url.href
}
