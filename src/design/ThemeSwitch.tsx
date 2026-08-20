import styler from '@alinea/styler'
import {Button} from './Button.js'
import css from './ThemeSwitch.module.css'

const styles = styler(css)

export interface ThemeSwitchProps {
  onChange: (theme: 'light' | 'dark') => void
  theme: 'light' | 'dark'
}

export function ThemeSwitch({onChange, theme}: ThemeSwitchProps) {
  return (
    <div
      aria-label="Preview theme"
      className={styles['alinea-ThemeSwitch']()}
      role="group"
    >
      <span className={styles['alinea-ThemeSwitch-label']()}>Theme</span>
      <Button
        appearance={theme === 'light' ? 'active' : 'plain'}
        aria-pressed={theme === 'light'}
        size="small"
        onClick={() => onChange('light')}
      >
        Light
      </Button>
      <Button
        appearance={theme === 'dark' ? 'active' : 'plain'}
        aria-pressed={theme === 'dark'}
        size="small"
        onClick={() => onChange('dark')}
      >
        Dark
      </Button>
    </div>
  )
}
