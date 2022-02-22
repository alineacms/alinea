import {Collection, SelectionInput} from '@alinea/store'
import {Entry} from './Entry'

export function select<T extends Entry>(
  makeSelection: (collection: Collection<T>) => SelectionInput
) {
  return makeSelection
}
