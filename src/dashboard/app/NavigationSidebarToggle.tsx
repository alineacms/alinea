import {Button} from '#/components.js'
import styler from '@alinea/styler'
import {MaterialSymbolsLeftPanelOpenOutlineRounded} from '../icons.js'
import css from './NavigationSidebarToggle.module.css'

const styles = styler(css)

export interface NavigationSidebarToggleProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function NavigationSidebarToggle({
  isOpen,
  onOpenChange
}: NavigationSidebarToggleProps) {
  return (
    <Button
      appearance="plain"
      aria-label={
        isOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'
      }
      aria-pressed={isOpen}
      size="icon"
      onPress={() => onOpenChange(!isOpen)}
    >
      <MaterialSymbolsLeftPanelOpenOutlineRounded
        className={styles.NavigationSidebarToggle.icon({open: isOpen})}
        data-slot="icon"
      />
    </Button>
  )
}
