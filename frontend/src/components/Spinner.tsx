export default function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 14, height: 14,
      border: '2px solid var(--border)',
      borderTop: '2px solid var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}