export function formatCurrency(amount, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount)
}

export function formatNumber(n) {
  return n.toLocaleString('vi-VN')
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

export function formatPercent(value, total) {
  if (!total) return '0%'
  return Math.round((value / total) * 100) + '%'
}
