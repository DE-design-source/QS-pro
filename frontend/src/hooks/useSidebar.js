import { useState } from 'react'
import { useLocalStorage } from './useLocalStorage'

function defaultLevel() {
  try { return localStorage.getItem('siteflow-sidebar-collapsed') === '1' ? 'icons' : 'full' } catch { return 'full' }
}

export function useSidebar() {
  const LEVELS = ['full', 'icons', 'logo']

  // Chưa có level đã lưu → dùng cờ "Thu gọn menu mặc định" ở trang Cài đặt (giống getSidebarLevel của bản HTML)
  const [level, setLevel] = useLocalStorage('siteflow-sidebar-level', defaultLevel())
  const [dir, setDir] = useState(level === 'logo' ? -1 : 1)

  function cycle() {
    setLevel(prev => {
      const idx = LEVELS.indexOf(prev) + dir
      const clamped = Math.max(0, Math.min(LEVELS.length - 1, idx))
      if (clamped >= LEVELS.length - 1) setDir(-1)
      if (clamped <= 0) setDir(1)
      return LEVELS[clamped]
    })
  }

  function collapse() {
    setLevel('logo')
    setDir(-1)
  }

  function expand() {
    setLevel('full')
    setDir(1)
  }

  return { level, cycle, collapse, expand }
}
