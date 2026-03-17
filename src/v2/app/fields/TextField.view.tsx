import {TextField as RacTextField} from '@alinea/components'
import {assert} from 'alinea/core/util/Assert.js'
import {TextField} from 'alinea/field/text'
import {useAtom, useAtomValue} from 'jotai'
import {DashboardEditor} from '../../dashboard/Dashboard.js'

export interface TextInputProps {
  editor: DashboardEditor
  field: TextField
}

export function TextFieldView({editor, field}: TextInputProps) {
  const info = editor.byField.get(field)
  assert(info, 'No field info found for field')
  const [value = '', setValue] = useAtom(info.value)
  const options = useAtomValue(info.options)
  return (
    <RacTextField label={options.label} value={value} onChange={setValue} />
  )
}
