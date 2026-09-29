import {ToggleGroup, ToggleGroupItem} from '#/components.js'
import {themeAtom, type DashboardTheme} from '#/dashboard/atoms/dashboard.js'
import {useAtom} from 'jotai'
import {
  IcRoundBrightness2,
  IcRoundDesktopWindows,
  IcRoundWbSunny
} from '../icons.js'

export function AppearanceToggle() {
  const [theme, setTheme] = useAtom(themeAtom)

  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label="Appearance"
      value={theme}
      onValueChange={value => {
        if (isDashboardTheme(value)) setTheme(value)
      }}
    >
      <ToggleGroupItem
        value="system"
        aria-label="Use system theme"
        icon={IcRoundDesktopWindows}
      />
      <ToggleGroupItem
        value="light"
        aria-label="Use light theme"
        icon={IcRoundWbSunny}
      />
      <ToggleGroupItem
        value="dark"
        aria-label="Use dark theme"
        icon={IcRoundBrightness2}
      />
    </ToggleGroup>
  )
}

function isDashboardTheme(value: string): value is DashboardTheme {
  return value === 'system' || value === 'light' || value === 'dark'
}
