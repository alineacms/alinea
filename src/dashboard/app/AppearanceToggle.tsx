import {ToggleButton, ToggleButtonGroup} from '#/components.js'
import {themeAtom, type DashboardTheme} from '#/dashboard/atoms/dashboard.js'
import {useAtom} from 'jotai'
import type {Key} from 'react-aria-components'
import {
  IcRoundBrightness2,
  IcRoundDesktopWindows,
  IcRoundWbSunny
} from '../icons.js'

export function AppearanceToggle() {
  const [theme, setTheme] = useAtom(themeAtom)

  return (
    <ToggleButtonGroup
      aria-label="Appearance"
      disallowEmptySelection
      selectedKeys={[theme]}
      selectionMode="single"
      variant="icon-small"
      onSelectionChange={(keys: Set<Key>) => {
        const selectedTheme = [...keys].at(0)
        if (isDashboardTheme(selectedTheme)) setTheme(selectedTheme)
      }}
    >
      <ToggleButton id="system" aria-label="Use system theme">
        <IcRoundDesktopWindows aria-hidden data-slot="icon" />
      </ToggleButton>
      <ToggleButton id="light" aria-label="Use light theme">
        <IcRoundWbSunny aria-hidden data-slot="icon" />
      </ToggleButton>
      <ToggleButton id="dark" aria-label="Use dark theme">
        <IcRoundBrightness2 aria-hidden data-slot="icon" />
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

function isDashboardTheme(value: Key | undefined): value is DashboardTheme {
  return value === 'system' || value === 'light' || value === 'dark'
}
