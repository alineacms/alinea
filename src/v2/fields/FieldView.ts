import type {FieldOptions} from 'alinea/core/Field'
import type {ComponentType} from 'react'

export interface EditorFieldOptions extends FieldOptions<unknown> {
  width?: number
  help?: unknown
  placeholder?: string
  multiline?: boolean
  description?: string
  options?: Record<string, string>
  type?: 'email' | 'tel' | 'text' | 'url'
}

export interface EntryFieldViewProps {
  id: string
  label: string
  value: unknown
  options: EditorFieldOptions
  readOnly: boolean
  required: boolean
  onChange: (value: unknown) => void
}

export interface EntryViews {
  [viewId: string]: ComponentType<EntryFieldViewProps>
}

