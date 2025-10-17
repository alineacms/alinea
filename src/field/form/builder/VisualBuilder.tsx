import {createId} from 'alinea/core/Id'
import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {list} from 'alinea/field/list/ListField'
import {number} from 'alinea/field/number'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import {VStack} from 'alinea/ui/Stack'
import {useAtomValue} from 'jotai'
import {useEffect} from 'react'
import type {FormDefinition} from '../FormField'

const TextField = type('Text', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    placeholer: text('Placeholder'),
    defaultValue: text('Default value'),
    maxLength: number('Max Length')
  }
})

const EmailField = type('Email', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5})
  }
})

const fields = type('Fields', {
  fields: {
    list: list('List', {
      schema: {
        TextField,
        EmailField
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
    const fieldSchema = formSchema.properties?.[key]
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
        const key = row.key || row._id
        newSchema.properties![key] = {
          type: 'string',
          title: row.title || '[No label]',
          default: row.defaultValue
        }
        newUiSchema[key] = {
          'ui:placeholder': row.placeholer || '',
          'ui:maxLength': row.maxLength ? Number(row.maxLength) : undefined
        }
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
