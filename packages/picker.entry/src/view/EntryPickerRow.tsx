import {EntryReference} from '../EntryPicker'

export interface EntryPickerRowProps {
  reference: EntryReference
}

export function EntryPickerRow({reference}: EntryPickerRowProps) {
  return <div>id: {reference.id}</div>
}
