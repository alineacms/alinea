import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {tab, tabs} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const fields = type('Tabs', {
  fields: {
    ...tabs(
      tab('Tab 1', {
        fields: {field1: text('Text field 1')}
      }),
      tab('Tab 2', {
        fields: {field2: text('Text field 2')}
      }),
      tab('Long tab name', {
        fields: {
          field3: text('Text field 3'),
          ...tabs(
            tab('Inner tab 1', {
              fields: {fieldA: text('Text field 1')}
            }),
            tab('Inner tab 2', {
              fields: {fieldB: text('Text field 2')}
            }),
            tab('Inner long tab name', {
              fields: {fieldC: text('Text field 3')}
            })
          )
        }
      })
    )
  }
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
