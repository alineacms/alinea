import {Field} from 'alinea/core'
import {InputState} from 'alinea/editor'
import {ErrorBoundary} from 'alinea/ui'

function MissingView() {
  return <div>Missing view</div>
}

export type InputProps<V, M> = {
  state: InputState<readonly [V, M]>
  field: Field<V, M>
}

// Todo: make error messages nice
export function Input<V, M>({state, field}: InputProps<V, M>) {
  const View = field.view
  if (!View) return <MissingView />
  return (
    <ErrorBoundary>
      <View state={state} field={field} />
    </ErrorBoundary>
  )
}
