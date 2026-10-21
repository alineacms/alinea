import {SheetSection} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import type {EditorNode} from '../atoms/editor.js'
import {NodeEditor} from './NodeEditor.js'

export interface BlockTabsProps {
  node: EditorNode
  type: Type
  readOnly?: boolean
}

/** The tabs of a block's type, as sections of its settings sheet */
export function BlockTabs({node, type, readOnly}: BlockTabsProps) {
  const tabs = Type.tabs(type)
  if (!tabs) return null
  return entries(tabs).map(([key, tab]) => (
    <SheetSection
      key={key}
      title={String(Type.label(tab))}
      icon={getType(tab).icon}
    >
      <NodeEditor node={node} type={tab} readOnly={readOnly} />
    </SheetSection>
  ))
}
