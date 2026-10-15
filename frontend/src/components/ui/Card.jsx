export default function Card({ children, style = {}, ...props }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
