import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import {
  IcOutlineDarkMode,
  IcOutlineLightMode,
  IcRoundDesktopWindows
} from '#/dashboard/icons.js'
import {Composition} from './Dashboard.stories.js'
import {Select, SelectItem} from './Select.js'
import css from './Theming.stories.module.css'
import {ToggleGroup, ToggleGroupItem} from './ToggleGroup.js'

const styles = styler(css)

const themes = {
  default: {label: 'Default', className: undefined},
  slate: {label: 'Slate', className: styles.ThemingStory.slate()},
  forest: {label: 'Forest', className: styles.ThemingStory.forest()},
  rose: {label: 'Rose', className: styles.ThemingStory.rose()},
  contrast: {label: 'High contrast', className: styles.ThemingStory.contrast()}
}

type ThemeName = keyof typeof themes

/**
 * The dashboard composition under example themes. A theme sets a handful of
 * input tokens (surfaces, text, border, primary, radius, fonts) on an element
 * with `data-alinea-theme`; every other shade is derived from those.
 */
export function Themes() {
  const [theme, setTheme] = useState<ThemeName>('default')
  const [scheme, setScheme] = useState('system')
  // Themes apply to the document so portalled popovers and dialogs follow
  useEffect(() => {
    const root = document.documentElement
    const {className} = themes[theme]
    root.dataset.alineaTheme = theme
    root.dataset.theme = scheme === 'system' ? '' : scheme
    if (className) root.classList.add(...className.split(' '))
    return () => {
      delete root.dataset.alineaTheme
      delete root.dataset.theme
      if (className) root.classList.remove(...className.split(' '))
    }
  }, [theme, scheme])
  return (
    <div className={styles.ThemingStory()}>
      <Composition />
      <div className={styles.ThemingStory.controls()}>
        <Select
          label="Theme"
          style={{width: 180}}
          value={theme}
          onValueChange={value => value && setTheme(value as ThemeName)}
        >
          {Object.entries(themes).map(([name, {label}]) => (
            <SelectItem key={name} value={name}>
              {label}
            </SelectItem>
          ))}
        </Select>
        <ToggleGroup
          type="single"
          value={scheme}
          onValueChange={value => value && setScheme(value)}
          aria-label="Color scheme"
        >
          <ToggleGroupItem
            value="system"
            icon={IcRoundDesktopWindows}
            aria-label="System"
          />
          <ToggleGroupItem
            value="light"
            icon={IcOutlineLightMode}
            aria-label="Light"
          />
          <ToggleGroupItem
            value="dark"
            icon={IcOutlineDarkMode}
            aria-label="Dark"
          />
        </ToggleGroup>
      </div>
    </div>
  )
}

export default {
  title: 'Pure components / Theming'
}
