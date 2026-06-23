function monthKey(userId) {
  const month = new Date().toISOString().slice(0, 7)
  return `podcastudio_ai_posts_${userId}_${month}`
}

export function getAiPostCount(userId) {
  if (!userId) return 0
  return parseInt(localStorage.getItem(monthKey(userId)) || '0', 10)
}

export function incrementAiPostCount(userId) {
  if (!userId) return 0
  const key = monthKey(userId)
  const next = getAiPostCount(userId) + 1
  localStorage.setItem(key, String(next))
  return next
}

export function canGenerateAiPosts(userId, limits) {
  if (!limits?.maxAiPostsPerMonth) return true
  return getAiPostCount(userId) < limits.maxAiPostsPerMonth
}

export function aiPostsRemaining(userId, limits) {
  if (!limits?.maxAiPostsPerMonth) return null
  return Math.max(0, limits.maxAiPostsPerMonth - getAiPostCount(userId))
}
