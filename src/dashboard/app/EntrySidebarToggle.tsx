import {Toggle} from '#/components.js'
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
  return (
    <Toggle
      className={className}
      pressed={isOpen}
      aria-label={isOpen ? 'Close entry sidebar' : 'Open entry sidebar'}
      onPressedChange={onOpenChange}
      icon={
        isOpen
          ? MaterialSymbolsRightPanelCloseRounded
          : MaterialSymbolsRightPanelOpenRounded
      }
    />
  )
}
