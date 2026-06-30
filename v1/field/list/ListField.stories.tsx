import {type} from '#/core/Type.js'
import {useForm} from '#/dashboard/atoms/FormAtoms.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {list} from '#/field/list/ListField.js'
import {text} from '#/field/text/TextField.js'
import {VStack} from '#/ui.js'
import {UIStory} from '#/ui/UIStory.js'

const RowA = type('Row A', {
  fields: {
    fieldA: text('Field A'),
    fieldB: text('Field B')
  }
})

const RowB = type('Row B', {
  fields: {
    fieldA: text('Field A'),
    fieldB: text('Field B')
  }
})

const fields = type('Fields', {
  fields: {
    list: list('List', {
      schema: {
        RowA,
        RowB
      }
    })
  }
})

export function ListField() {
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
  title: 'Fields / List'
}
