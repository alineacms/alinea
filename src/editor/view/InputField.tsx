import {Field} from 'alinea/core/Field'
import {InputState} from '../InputState.js'
import {MissingView} from './Input.js'

export interface InputFieldBase<V, M> {
  field: Field<V, M>
}

export interface InputFieldWithState<V, M> extends InputFieldBase<V, M> {
  state: InputState<readonly [V, M]>
}

export interface InputFieldController<V, M> extends InputFieldBase<V, M> {
  value: V
  onChange: M
}

export type InputFieldProps<V, M> =
  | InputFieldWithState<V, M>
  | InputFieldController<V, M>

export function InputField<V, M>({field, ...rest}: InputFieldProps<V, M>) {
  const state =
    'value' in rest
      ? new InputState.StatePair(rest.value, rest.onChange)
      : rest.state
  const View = Field.view(field)
  if (!View) return <MissingView field={field} />
  return <View field={field} state={state} />
}
