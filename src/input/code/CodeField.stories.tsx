import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {code} from 'alinea/input/code'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function CodeField() {
  const codeField = useField(code('Code'))
  const disabledCodeField = useField(
    code('Code (read-only)', {
      readonly: true,
      initialValue: `console.log('Hello world!')`
    })
  )
  return (
    <UIStory>
      <VStack>
        <InputField {...codeField} />
        <InputField {...disabledCodeField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Code'
}
