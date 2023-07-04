import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {json} from 'alinea/input/json'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

export function JsonInput() {
  const jsonField = useField(json('Json'))
  const focusedJsonField = useField(json('Json (autofocus)', {autoFocus: true}))
  const readonlyJsonField = useField(json('Json (read-only)', {readonly: true}))
  return (
    <UIStory>
      <VStack>
        <InputField {...jsonField} />
        <InputField {...focusedJsonField} />
        <InputField {...readonlyJsonField} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Json'
}
