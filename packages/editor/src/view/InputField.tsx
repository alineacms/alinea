import {Field} from '@alinea/core/Field'
import {InputState} from '../InputState'

export interface InputFieldProps<V, M> {
  field: Field<V, M>
  value: V
  onChange: M
}

export function InputField<V, M>({
  field,
  value,
  onChange
}: InputFieldProps<V, M>) {
  const state = new InputState.StatePair(value, onChange)
  const View = field.view!
  return <View field={field} state={state} />
}
