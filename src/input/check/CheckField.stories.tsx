import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {check} from 'alinea/input/check'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function CheckField() {
  const checkField = useField(check('Check', {inline: true}))
  const focusedCheckField = useField(
    check('Check (autofocus)', {inline: true, autoFocus: true})
  )
  const checkedCheckField = useField(
    check('Check (checked by default)', {inline: true, initialValue: true})
  )
  const readonlyCheckField = useField(
    check('Check (read-only)', {inline: true, readOnly: true})
  )
  return (
    <UIStory>
      <VStack>
        <InputField {...checkField} />
        <InputField {...focusedCheckField} />
        <InputField {...checkedCheckField} />
        <InputField {...readonlyCheckField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Check'
}
