import styler from '@alinea/styler'
import Form from '@rjsf/core'
import {RJSFSchema} from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import {useField} from 'alinea/dashboard/editor/UseField'
import {HStack} from 'alinea/ui/Stack'
import {TextareaAutosize} from 'alinea/ui/util/TextareaAutosize'
import {useState} from 'react'
import {VisualBuilder} from './builder/VisualBuilder.js'
import type {FormDefinition, FormField} from './FormField'
import css from './FormField.module.scss'

const styles = styler(css)

export interface FormInputProps {
  field: FormField
}

const tabs = ['builder', 'schema', 'preview'] as const
type Tab = (typeof tabs)[number]

export function FormInput({field}: FormInputProps) {
  const {options, value, mutator, error} = useField(field)

  const [tab, setTab] = useState<Tab>('builder')
  const formSchema = value?.schema || {}
  const uiSchema = value?.ui || {}

  return (
    <div>
      <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
        {tabs.map(t => (
          <button
            type="button"
            key={t}
            style={{
              textDecoration: tab === t ? 'underline' : 'none',
              cursor: 'pointer'
            }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{marginTop: '12px'}}>
        {tab === 'builder' && (
          <VisualBuilder
            formSchema={formSchema}
            uiSchema={uiSchema}
            setSchemas={value => mutator(value)}
          />
        )}
        {tab === 'schema' && (
          <FormSchema
            formSchema={formSchema}
            uiSchema={uiSchema}
            setFormSchema={schema => mutator({schema, ui: uiSchema})}
            setUiSchema={ui => mutator({schema: formSchema, ui})}
          />
        )}
        {tab === 'preview' && (
          <Preview formSchema={formSchema} uiSchema={uiSchema} />
        )}
      </div>
    </div>
  )
}

function Preview({
  formSchema,
  uiSchema
}: {
  formSchema: FormDefinition['schema']
  uiSchema: FormDefinition['ui']
}) {
  const log = (type: string) => console.log.bind(console, type)
  return (
    <Form
      schema={formSchema}
      uiSchema={uiSchema}
      validator={validator}
      onChange={log('changed')}
      onSubmit={log('submitted')}
      onError={log('errors')}
    />
  )
}

function FormSchema({
  formSchema,
  uiSchema,
  setFormSchema,
  setUiSchema
}: {
  formSchema: FormDefinition['schema']
  uiSchema: FormDefinition['ui']
  setFormSchema: (schema: FormDefinition['schema']) => void
  setUiSchema: (ui: FormDefinition['ui']) => void
}) {
  const [text, setText] = useState(JSON.stringify(formSchema, null, 2))
  const [valid, setValid] = useState(true)

  return (
    <div>
      <h2>Schema definition</h2>
      <div>
        <label htmlFor="form-schema">Form schema</label>
        <JSONTextAreaField value={formSchema} mutator={setFormSchema} />
      </div>
      <div>
        <label htmlFor="ui-schema">UI schema</label>
        <JSONTextAreaField value={uiSchema} mutator={setUiSchema} />
      </div>
    </div>
  )
}

function JSONTextAreaField({
  value,
  mutator
}: {
  value: any
  mutator: (value: any) => void
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [valid, setValid] = useState(true)
  return (
    <HStack center gap={8}>
      <TextareaAutosize
        className={styles.root.input({valid})}
        style={{
          border: '2px solid',
          borderColor: valid ? 'green' : 'red'
        }}
        type="text"
        value={text || ''}
        onChange={e => {
          setText(e.currentTarget.value)
          try {
            const parsed = JSON.parse(e.currentTarget.value)
            mutator(parsed)
            setValid(true)
          } catch {
            setValid(false)
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            const target = e.target as HTMLInputElement
            const start = target.selectionStart!
            const end = target.selectionEnd!
            const value = target.value

            if (end !== value.length) {
              e.preventDefault()
              target.value = `${value.substring(0, start)}  ${value.substring(end)}`
              target.selectionStart = target.selectionEnd = start + 2
            }
          }
        }}
        onBlur={e => {
          if (valid) {
            setText(JSON.stringify(value, null, 2))
          }
        }}
        placeholder={'{}'}
      />
    </HStack>
  )
}
