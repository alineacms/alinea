import {Reference} from '@alinea/core/Reference'
import {Expr} from '@alinea/store/Expr'
import {
  ComponentType,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState
} from 'react'
import {ReferencePicker} from '../view/ReferencePicker'

export type ReferencePickerFunc = (
  options: ReferencePickerOptions
) => Promise<Array<Reference> | undefined>

export type ReferencePickerOptions = {
  selection: Array<Reference> | undefined
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  max?: number
  showUploader?: boolean
}

type ReferencePickerContext = {
  pickLink: ReferencePickerFunc
  isOpen: boolean
  PickerSlot: ComponentType
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
  const [hasSlot, setHasSlot] = useState(false)
  const modal = options && (
    <ReferencePicker
      options={options}
      onConfirm={trigger ? trigger[0] : () => {}}
      onCancel={trigger ? trigger[1] : () => {}}
    />
  )
  function PickerSlot() {
    useEffect(() => {
      setHasSlot(true)
      return () => setHasSlot(false)
    })
    return <>{modal}</>
  }
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
        },
        isOpen: Boolean(options),
        PickerSlot
      }}
    >
      {!hasSlot && modal}
      {children}
    </context.Provider>
  )
}
