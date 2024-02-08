import {type} from 'alinea/core'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {list} from 'alinea/field/list/ListField'
import {text} from 'alinea/field/text/TextField'
import {VStack} from 'alinea/ui'
import {UIStory} from 'alinea/ui/UIStory'

const RowA = type('Row A', {
  fieldA: text('Field A'),
  fieldB: text('Field B')
})

const RowB = type('Row B', {
  fieldA: text('Field A'),
  fieldB: text('Field B')
})

const fields = type({
  list: list('List', {
    schema: {
      RowA,
      RowB
    }
  })
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
