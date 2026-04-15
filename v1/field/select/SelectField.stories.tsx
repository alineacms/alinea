import {track} from '#/core/Tracker.js'
import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {select} from '#/field/select.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const options = {
  option1: 'Option 1',
  option2: 'Option 2'
}

const fields = type('Fields', {
  fields: {
    selectA: select('Select', {
      initialValue: 'one',
      options: {
        one: 'Option 1',
        two: 'Option 2'
      }
    }),
    selectB: select('Select (tracked)', {options}),
    readOnly: select('Select (read-only)', {options, readOnly: true})
  }
})

track.options(fields.selectB, get => {
  const value = get(fields.selectA)
  return {
    readOnly: value === 'one'
  }
})

export function SelectField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack>
        <InputForm form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Select'
}
