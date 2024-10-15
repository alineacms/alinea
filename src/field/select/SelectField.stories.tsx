import {track} from 'alinea/core/Tracker'
import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {select} from 'alinea/field/select'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const options = {
  option1: 'Option 1',
  option2: 'Option 2'
}

const fields = type({
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
