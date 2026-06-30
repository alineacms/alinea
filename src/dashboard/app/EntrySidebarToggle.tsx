import {ToggleButton} from '#/components.js'
import {
  MaterialSymbolsRightPanelCloseRounded,
  MaterialSymbolsRightPanelOpenRounded
} from '../icons.js'

export interface EntrySidebarToggleProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function EntrySidebarToggle({
  isOpen,
  onOpenChange
}: EntrySidebarToggleProps) {
  const Icon = isOpen
    ? MaterialSymbolsRightPanelCloseRounded
    : MaterialSymbolsRightPanelOpenRounded
  return (
    <ToggleButton
      isSelected={isOpen}
      aria-label={isOpen ? 'Close entry sidebar' : 'Open entry sidebar'}
      onChange={onOpenChange}
    >
      <Icon data-slot="icon" />
    </ToggleButton>
  )
}
