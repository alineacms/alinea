import type {EntryActionProps} from '#/core/DashboardEntry.js'
import type {Entry} from '#/core/Entry.js'
import {getType} from '#/core/Internal.js'
import type {Type} from '#/core/Type.js'
import {resolveView} from '#/core/View.js'
import {useAtomValueRaw} from 'jotai'
import {useMemo} from 'react'
import type {EditorNode} from '../atoms/editor.js'
import {viewsAtom} from '../atoms/core.js'
import {dashboardEntry} from '../cms/hooks.js'
import {NodeEditor} from './NodeEditor.js'

export interface EntryActionsProps {
  type: Type
  node: EditorNode
  entry: Entry
  locale: string | null
}

/** The actions configured with the `actions` option of a type */
export function EntryActions({type, node, entry, locale}: EntryActionsProps) {
  const views = useAtomValueRaw(viewsAtom)
  const actions = getType(type).actions ?? []
  const props = useMemo(
    (): EntryActionProps => ({entry: dashboardEntry(entry), locale}),
    [entry, locale]
  )
  if (actions.length === 0) return null
  return (
    <NodeEditor node={node} type={type}>
      {actions.map((view, index) => {
        const Action = resolveView<EntryActionProps>(views, view)
        return Action ? <Action key={index} {...props} /> : null
      })}
    </NodeEditor>
  )
}
