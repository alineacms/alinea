import {ToggleButton} from '#/components.js'
import {
  MaterialSymbolsRightPanelCloseRounded,
  MaterialSymbolsRightPanelOpenRounded
} from '../icons.js'

export interface EntrySidebarToggleProps {
  className?: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function EntrySidebarToggle({
  className,
  isOpen,
  onOpenChange
}: EntrySidebarToggleProps) {
  const Icon = isOpen
    ? MaterialSymbolsRightPanelCloseRounded
    : MaterialSymbolsRightPanelOpenRounded
  return (
    <ToggleButton
      className={className}
      isSelected={isOpen}
      aria-label={isOpen ? 'Close entry sidebar' : 'Open entry sidebar'}
      onChange={onOpenChange}
    >
      <Icon data-slot="icon" />
    </ToggleButton>
  )
}
