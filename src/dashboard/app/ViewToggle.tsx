import {ToggleGroup, ToggleGroupItem} from '#/components.js'
import type {ExplorerView} from '../atoms/explorer.js'
import {IcOutlineGridView, IcOutlineList} from '../icons.js'

interface ViewToggleProps {
  setView: (view: ExplorerView) => void
  size?: 'default' | 'sm'
  view: ExplorerView
}

export function ViewToggle({setView, size, view}: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size={size}
      aria-label="Explorer view"
      value={view}
      onValueChange={value => {
        if (value === 'card' || value === 'row') setView(value)
      }}
    >
      <ToggleGroupItem value="row" aria-label="Row view" icon={IcOutlineList} />
      <ToggleGroupItem
        value="card"
        aria-label="Card view"
        icon={IcOutlineGridView}
      />
    </ToggleGroup>
  )
}
