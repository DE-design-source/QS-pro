const PREFIX = 'siteflow-'

export const storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(PREFIX + key)
      return item !== null ? JSON.parse(item) : fallback
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      console.warn('storage.set failed for key:', key)
    }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key) } catch {}
  },
}
