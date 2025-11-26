import {createId} from 'alinea/core/Id'
import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {list} from 'alinea/field/list/ListField'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import {VStack} from 'alinea/ui/Stack'
import {useAtomValue} from 'jotai'
import {useEffect} from 'react'
import type {FormDefinition} from './FormField'
import {addTextFieldToRJSF, FormTextField, transformFieldSchemaToTextField} from './builder/FormTextField.js'
import { addSelectFieldToRJSF, FormSelectField, transformFieldSchemaToSelectField } from './builder/FormSelectField.js'

const baseSchema = {
  TextField: FormTextField,
  SelectField: FormSelectField,
}

const ArrayField = type('Array', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    items: list('Fields', {
      schema: baseSchema
    })
  }
})

const OneOfField = type('OneOf', {
  fields: {
    option1: list('Option1', {
      schema: baseSchema
    }),
    option2: list('Option2', {
      schema: baseSchema
    })
  }
})

const TwoColumns = type('TwoColumns', {
  fields: {
    left: list('Left', {
      inline: true,
      width: 0.5,
      schema: baseSchema
    }),
    right: list('Right', {
      inline: true,
      width: 0.5,
      schema: baseSchema
    })
  }
})

const fields = type('Fields', {
  fields: {
    list: list('List', {
      schema: {
        ...baseSchema,
        ArrayField,
        OneOfField,
        TwoColumns
      }
    })
  }
})

export type ListDataType = Infer.ListItem<typeof fields>['list']

// From specific to general
const transformators = [
  {_type: 'SelectField', transform: transformFieldSchemaToSelectField},
  {_type: 'TextField', transform: transformFieldSchemaToTextField},
 ] as const

function formSchemasToListData(
  formSchema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui']
): ListDataType {
  console.log('formSchemasToListData', formSchema, uiSchema)

  const result: ListDataType = []

  for (const key of Object.keys(formSchema?.properties || {})) {
    const fieldSchema = formSchema.properties?.[key] 
    const uiFieldSchema = uiSchema?.[key] || {}

    if (!fieldSchema || fieldSchema === true) continue

    const id = createId()
    const lastItem = result[result.length - 1]
    const index = generateKeyBetween(lastItem?._index || null, null)


    for(const transformator of transformators){
      const data = transformator.transform(key, fieldSchema, formSchema, uiSchema)
      if(!data) continue
      console.log(transformator._type, data)
      result.push({
        _id: id,
        _index: index,
        _type: transformator._type as any, // TODO: find an elegant way to type this
        ...data,
      })
      break
    }
  }

  return result
}

export function VisualBuilder({
  formSchema,
  uiSchema,
  setSchemas
}: {
  formSchema: FormDefinition['schema']
  uiSchema: FormDefinition['ui']
  setSchemas: (value: FormDefinition) => void
}) {
  const form = useForm(fields, {
    initialValue: {
      list: formSchemasToListData(formSchema, uiSchema)
    }
  })
  const listField = form.fieldInfo(fields.list)
  const data = useAtomValue(listField.value)

  useEffect(() => {
    const newSchema: FormDefinition['schema'] = {
      properties: {}
    }
    const newUiSchema: FormDefinition['ui'] = {}

    for (const row of data) {
      if (row._type === 'TextField') {
        addTextFieldToRJSF(newSchema, newUiSchema, row)
      }
      if(row._type === 'SelectField'){
        addSelectFieldToRJSF(newSchema, newUiSchema, row)
      }
    }
    setSchemas({schema: newSchema, ui: newUiSchema})
  }, [data])

  return (
    <VStack>
      <InputForm form={form} />
    </VStack>
  )
}
