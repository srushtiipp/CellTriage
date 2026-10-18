import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className="hover-edge relative flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-app-surface text-text-secondary hover:border-accent/40 hover:text-accent-strong"
    >
      <Sun
        size={15}
        strokeWidth={1.75}
        className={`absolute transition-all duration-180 ${
          isDark ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
      />
      <Moon
        size={15}
        strokeWidth={1.75}
        className={`absolute transition-all duration-180 ${
          isDark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
      />
    </button>
  )
}
