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
import type {FormDefinition} from '../FormField'
import {addTextFieldToRJSF, FormTextField} from './text/FormTextField.js'

const EmailField = type('Email', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5})
  }
})

const baseSchema = {
  TextField: FormTextField,
  EmailField
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

type ListDataType = Infer.ListItem<typeof fields>['list']

function formSchemasToListData(
  formSchema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui']
): ListDataType {
  console.log('formSchemasToListData', formSchema, uiSchema)

  const result: ListDataType = []

  for (const key of Object.keys(formSchema?.properties || {})) {
    const fieldSchema = formSchema.properties?.[key] as any
    const uiFieldSchema = uiSchema?.[key] || {}

    if (!fieldSchema) continue

    const id = createId()
    const lastItem = result[result.length - 1]
    const index = generateKeyBetween(lastItem?._index || null, null)

    if (fieldSchema.type === 'string' && fieldSchema.format === 'email') {
      result.push({
        _id: id,
        _index: index,
        _type: 'EmailField',
        title: fieldSchema.title || '[No label]',
        key: key
      })
    } else if (fieldSchema.type === 'string') {
      result.push({
        _id: id,
        _index: index,
        _type: 'TextField',
        title: fieldSchema.title || '[No label]',
        key: key,
        placeholer: uiFieldSchema?.['ui:placeholder'] || '',
        defaultValue: fieldSchema.default || '',
        maxLength: uiFieldSchema?.['ui:maxLength']
          ? parseInt(uiFieldSchema['ui:maxLength'], 10)
          : null
      })
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
      if (row._type === 'EmailField') {
        const key = row.key || row._id
        newSchema.properties![key] = {
          type: 'string',
          format: 'email',
          title: row.title || '[No label]'
        }
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
