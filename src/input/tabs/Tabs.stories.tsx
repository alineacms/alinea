import {type} from 'alinea/core/Type'
import {InputForm} from 'alinea/editor'
import {tab, tabs} from 'alinea/input/tabs'
import {text} from 'alinea/input/text'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'
import {useForm} from '../../editor/hook/UseForm.js'

export function TabsField() {
  const tabsForm = useForm({
    type: type('Tabs', {
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
  })
  return (
    <UIStory>
      <VStack style={{minWidth: '600px'}}>
        <InputForm {...tabsForm} />
      </VStack>
    </UIStory>
  )
}

/*export default {
  title: 'Fields / Tabs'
}*/
