export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  style = {},
  ...props
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    borderRadius: '9px',
    transition: 'filter 0.12s ease',
  }

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '12px' },
    md: { padding: '9px 18px', fontSize: '13px' },
    lg: { padding: '11px 22px', fontSize: '14px' },
  }

  const variants = {
    primary: { background: 'var(--primary)', color: '#fff' },
    ghost: { background: 'var(--surface-alt)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'var(--danger)', color: '#fff' },
  }

  return (
    <button
      onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  )
}
