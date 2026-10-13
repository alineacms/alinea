import {SheetSection} from '#/components.js'
import {Type} from '#/core/Type.js'
import type {EditorNode} from '../atoms/editor.js'
import {EditFields} from './EntryFields.js'
import {NodeEditor} from './NodeEditor.js'

export interface BlockSettingsProps {
  node: EditorNode
  type: Type
  readOnly?: boolean
}

/** The settings fields of a block's type, for its settings sheet */
export function BlockSettings({node, type, readOnly}: BlockSettingsProps) {
  const settings = Type.settings(type)
  if (!settings) return null
  return (
    <SheetSection title="Settings">
      <NodeEditor node={node} type={type} readOnly={readOnly}>
        <EditFields fields={settings} />
      </NodeEditor>
    </SheetSection>
  )
}
