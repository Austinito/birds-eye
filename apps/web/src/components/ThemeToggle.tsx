import { useThemeMode } from '../theme'
import { MoonIcon, SunIcon } from './icons'

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeMode()

  return (
    <button
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-pressed={theme === 'dark'}
      className={`theme-toggle ${theme === 'dark' ? 'theme-toggle-dark' : 'theme-toggle-light'}`}
      onClick={toggleTheme}
      type="button"
    >
      <span className="theme-toggle-track" aria-hidden>
        <span className="theme-toggle-thumb" />
        <span className="theme-toggle-icon theme-toggle-icon-light">
          <SunIcon className="theme-toggle-svg" />
        </span>
        <span className="theme-toggle-icon theme-toggle-icon-dark">
          <MoonIcon className="theme-toggle-svg" />
        </span>
      </span>
    </button>
  )
}
