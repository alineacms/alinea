import {type} from 'alinea/core/Type'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {tab, tabs} from 'alinea/field/tabs'
import {text} from 'alinea/field/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const fields = type('Tabs', {
  ...tabs(
    tab('Tab 1', {
      field1: text('Text field 1')
    }),
    tab('Tab 2', {
      field2: text('Text field 2')
    }),
    tab('Long tab name', {
      field3: text('Text field 3'),
      ...tabs(
        tab('Inner tab 1', {
          fieldA: text('Text field 1')
        }),
        tab('Inner tab 2', {
          fieldB: text('Text field 2')
        }),
        tab('Inner long tab name', {
          fieldC: text('Text field 3')
        })
      )
    })
  )
})

export function TabsField() {
  const form = useForm(fields)
  return (
    <UIStory>
      <VStack style={{minWidth: '600px'}}>
        <InputForm form={form} />
      </VStack>
    </UIStory>
  )
}

export default {
  title: 'Fields / Tabs'
}
