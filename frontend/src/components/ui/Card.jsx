export default function Card({
  children,
  className = '',
  as: Tag = 'div',
  interactive = false,
  radius = 'card',
  ...props
}) {
  const radiusClass = radius === 'cardLg' ? 'rounded-cardLg' : 'rounded-card'
  return (
    <Tag
      className={`bg-app-surface border border-app-border ${radiusClass} shadow-subtle ${
        interactive ? 'hover-lift' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}
