import {Field} from '@alinea/core'
import {InputState} from '@alinea/editor'
import {HStack, px, Typo} from '@alinea/ui'
import {MdWarning} from 'react-icons/md'
import useErrorBoundary from 'use-error-boundary'

function MissingView() {
  return <div>Missing view</div>
}

export type InputProps<T> = {
  state: InputState<T>
  field: Field<T>
}

// Todo: make error messages nice
export function Input<T>({state, field}: InputProps<T>) {
  const {ErrorBoundary, didCatch, error} = useErrorBoundary()
  const View = field.view
  if (!View) return <MissingView />
  return (
    <>
      {didCatch ? (
        <HStack center gap={10} style={{padding: px(10)}}>
          <MdWarning size={20} />
          <Typo.Monospace>Error: {error.message}</Typo.Monospace>
        </HStack>
      ) : (
        <ErrorBoundary>
          <View state={state} field={field} />
        </ErrorBoundary>
      )}
    </>
  )
}
