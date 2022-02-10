import {Field} from '@alinea/core'
import {InputState} from '@alinea/editor'

function MissingView() {
  return <div>Missing view</div>
}

export type InputProps<T> = {
  state: InputState<T>
  field: Field<T>
}

export function Input<T>({state, field}: InputProps<T>) {
  const View = field.view
  if (!View) return <MissingView />
  return <View state={state} field={field} />
}
