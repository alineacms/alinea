import {Field} from 'alinea/core'
import {InputState} from 'alinea/editor'
import {ErrorBoundary, TextLabel} from 'alinea/ui'

interface MissingViewProps {
  field: Field<any, any>
}

function MissingView({field}: MissingViewProps) {
  return (
    <div>
      Missing view for field: <TextLabel label={field.label} />
    </div>
  )
}

export type InputProps<V, M> = {
  state: InputState<readonly [V, M]>
  field: Field<V, M>
}

// Todo: make error messages nice
export function Input<V, M>({state, field}: InputProps<V, M>) {
  const View = field.view
  if (!View) return <MissingView field={field} />
  return (
    <ErrorBoundary>
      <View state={state} field={field} />
    </ErrorBoundary>
  )
}
