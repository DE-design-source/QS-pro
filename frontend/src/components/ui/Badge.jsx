export default function Badge({ children, color = 'primary', style = {} }) {
  return (
    <span style={{
      padding: '1px 8px',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: 700,
      background: `var(--${color}-tint)`,
      color: `var(--${color})`,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </span>
  )
}
