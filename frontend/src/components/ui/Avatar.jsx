export default function Avatar({ initials, color = 'primary', size = 36, style = {} }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `var(--${color}-tint)`,
      color: `var(--${color})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: size * 0.36,
      flex: 'none',
      ...style,
    }}>
      {initials}
    </div>
  )
}
