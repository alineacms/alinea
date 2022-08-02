import {Reference} from '@alinea/core'
import {useTrigger} from '@alinea/ui/hook/UseTrigger'
import {useMemo} from 'react'
import {Picker, PickerOptions} from '../Picker'

export function usePicker(pickers: Record<string, Picker>) {
  const trigger = useTrigger<Array<Reference> | undefined, PickerOptions>()
  return useMemo(() => {
    function Modal() {
      if (!trigger.options) return null
      const picker = pickers[trigger.options.type]
      const View = picker.view
      return (
        <View
          options={trigger.options}
          onConfirm={trigger.resolve}
          onCancel={trigger.reject}
        />
      )
    }
    return {
      Modal,
      pick: trigger.request,
      isActive: trigger.isActive
    }
  }, [trigger])
}
