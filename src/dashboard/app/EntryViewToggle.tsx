import {ToggleGroup, ToggleGroupItem} from '#/components.js'
import type {EntryAtoms} from '#/dashboard/atoms/entry.js'
import {type Page, routeAtom} from '#/dashboard/atoms/nav.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {IcOutlineTableRows, IcRoundEdit} from '../icons.js'
import css from './EntryViewToggle.module.css'

const styles = styler(css)

export interface EntryViewToggleProps {
  entry: EntryAtoms
  page: Page
}

/**
 * Switches between editing an entry and the overview of its children, in the
 * same place in both headers
 */
export function EntryViewToggle({entry, page}: EntryViewToggleProps) {
  const entryView = useAtomValueRaw(entry.view)
  const hasChildren = useAtomValueRaw(entry.hasChildren)
  const setRoute = useSetAtom(routeAtom)
  const view = page.view ?? entryView
  if (!hasChildren && entryView !== 'overview' && view !== 'overview')
    return null
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label="Entry view"
      className={styles.EntryViewToggle()}
      value={view === 'overview' ? 'overview' : 'edit'}
      onValueChange={value => {
        if (value !== 'edit' && value !== 'overview') return
        setRoute({
          workspace: page.workspace,
          root: page.root,
          entry: page.entry,
          locale: page.locale ?? undefined,
          view: value
        })
      }}
    >
      <ToggleGroupItem
        value="edit"
        aria-label="Edit entry"
        icon={IcRoundEdit}
      />
      <ToggleGroupItem
        value="overview"
        aria-label="Show overview"
        icon={IcOutlineTableRows}
      />
    </ToggleGroup>
  )
}
