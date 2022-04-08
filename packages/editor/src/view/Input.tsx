import {Field} from '@alineacms/core'
import {InputState} from '@alineacms/editor'
import {HStack, px, Typo} from '@alineacms/ui'
import {MdWarning} from 'react-icons/md'
import useErrorBoundary from 'use-error-boundary'

function MissingView() {
  return <div>Missing view</div>
}

export type InputProps<V, M> = {
  state: InputState<readonly [V, M]>
  field: Field<V, M>
}

// Todo: make error messages nice
export function Input<V, M>({state, field}: InputProps<V, M>) {
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
