import {ToggleGroup, ToggleGroupItem} from '#/components.js'
import {IcOutlineGridView, IcOutlineList} from '#/dashboard/icons.js'

export type ExplorerView = 'card' | 'row'

interface ViewToggleProps {
  setView: (view: ExplorerView) => void
  view: ExplorerView
}

export function ViewToggle({setView, view}: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label="Explorer view"
      value={view}
      onValueChange={value => {
        if (value === 'card' || value === 'row') setView(value)
      }}
    >
      <ToggleGroupItem
        value="card"
        aria-label="Card view"
        icon={IcOutlineGridView}
      />
      <ToggleGroupItem value="row" aria-label="Row view" icon={IcOutlineList} />
    </ToggleGroup>
  )
}
