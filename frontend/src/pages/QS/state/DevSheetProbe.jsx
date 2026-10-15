import { useLinesSheet } from './useLinesSheet'

/* Chỉ ở dev (QS.jsx vẽ khi import.meta.env.DEV): đưa mặt tiền sheet ra window để kiểm thử Playwright. Không vẽ gì. */
export default function DevSheetProbe() {
  const all = useLinesSheet({ hm: '' })
  if (typeof window !== 'undefined') window.__qsSheetProbe = all
  return null
}
