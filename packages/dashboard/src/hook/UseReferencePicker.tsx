import {Reference} from '@alinea/core/Reference'
import {Expr} from '@alinea/store/Expr'
import {ComponentType, useMemo, useState} from 'react'
import {ReferencePicker} from '../view/picker/ReferencePicker'

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

type PickerTrigger = [(value: Array<Reference> | undefined) => void, () => void]
type ReferencePickerContext = {
  pickLink: ReferencePickerFunc
  isOpen: boolean
  Modal: ComponentType
}

export function useReferencePicker(): ReferencePickerContext {
  const [trigger, setTrigger] = useState<PickerTrigger | undefined>(undefined)
  const [options, setOptions] = useState<ReferencePickerOptions | undefined>(
    undefined
  )
  return useMemo(() => {
    function Modal() {
      if (!options) return null
      return (
        <ReferencePicker
          options={options}
          onConfirm={trigger ? trigger[0] : () => {}}
          onCancel={trigger ? trigger[1] : () => {}}
        />
      )
    }
    return {
      Modal,
      pickLink(
        options: ReferencePickerOptions
      ): Promise<Array<Reference> | undefined> {
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
      isOpen: Boolean(options)
    }
  }, [options, trigger])
}
