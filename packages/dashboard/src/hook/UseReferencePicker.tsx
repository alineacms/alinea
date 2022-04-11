import {Reference} from '@alinea/core/Reference'
import {Expr} from '@alinea/store/Expr'
import {createContext, PropsWithChildren, useContext, useState} from 'react'
import {ReferencePicker} from '../view/ReferencePicker'

export type ReferencePickerOptions = {
  selection: Array<Reference> | undefined
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  max?: number
  showUploader?: boolean
}

type ReferencePickerContext = {
  pickLink: (
    options: ReferencePickerOptions
  ) => Promise<Array<Reference> | undefined>
}

const context = createContext<ReferencePickerContext | undefined>(undefined)

export function useReferencePicker() {
  return useContext(context)!
}

type PickerTrigger = [(value: Array<Reference> | undefined) => void, () => void]

export function ReferencePickerProvider({children}: PropsWithChildren<{}>) {
  const [trigger, setTrigger] = useState<PickerTrigger | undefined>(undefined)
  const [options, setOptions] = useState<ReferencePickerOptions | undefined>(
    undefined
  )
  return (
    <context.Provider
      value={{
        pickLink(options): Promise<Array<Reference> | undefined> {
          return new Promise(
            (
              resolve: (value: Array<Reference> | undefined) => void,
              reject: () => void
            ) => {
              setOptions(options)
              setTrigger([resolve, reject])
            }
          )
            .finally(() => {
              setOptions(undefined)
              setTrigger(undefined)
            })
            .catch(() => {
              return undefined
            })
        }
      }}
    >
      {options && (
        <ReferencePicker
          options={options}
          onConfirm={trigger ? trigger[0] : () => {}}
          onCancel={trigger ? trigger[1] : () => {}}
        />
      )}
      {children}
    </context.Provider>
  )
}
