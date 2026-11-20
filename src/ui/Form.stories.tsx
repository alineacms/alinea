import type {FormDefinition} from '#/field/form/FormDefinition.js'
import type {FormResult} from '#/field/form/FormSubmission.js'
import {Form} from './Form.js'

const definition: FormDefinition = [
  {
    id: 'service',
    type: 'radio',
    label: 'Service',
    control: 'radio',
    key: 'service',
    required: true,
    width: 'full',
    attributes: {},
    settings: {},
    choices: [
      {id: 'it', label: 'IT', value: 'it'},
      {id: 'hr', label: 'HR', value: 'hr'}
    ]
  },
  {
    id: 'device',
    type: 'text',
    label: 'Device',
    control: 'input',
    key: 'device',
    required: true,
    width: 'full',
    attributes: {type: 'text'},
    settings: {},
    showWhen: {match: 'all', rules: [{input: 'service', op: 'filled'}]},
    disableWhen: {
      match: 'all',
      rules: [{input: 'service', op: 'is', value: ['hr']}]
    }
  },
  {
    id: 'details',
    type: 'section',
    label: 'Details',
    control: 'section',
    showWhen: {
      match: 'all',
      rules: [{input: 'device', op: 'contains', value: 'laptop'}]
    },
    inputs: [
      {
        id: 'model',
        type: 'text',
        label: 'Model',
        control: 'input',
        key: 'model',
        required: false,
        width: 'full',
        attributes: {type: 'text'},
        settings: {}
      }
    ]
  }
]

/** Inputs show and are disabled as the answers above them change */
export function Rules() {
  return (
    <div style={{maxWidth: 480, padding: 24}}>
      <Form aria-label="Request" definition={definition} />
    </div>
  )
}

async function send(data: FormData): Promise<FormResult> {
  await new Promise(resolve => setTimeout(resolve, 100))
  const device = data.get('device')
  if (!device) return {ok: false, errors: {device: 'Fill in this field'}}
  if (device === 'Toaster')
    return {ok: false, errors: {device: 'We do not repair toasters'}}
  return {ok: true, confirmation: `We will look at your ${device}.`}
}

/** Sends to an action, which answers with errors or a confirmation */
export function Submit() {
  return (
    <div style={{maxWidth: 480, padding: 24}}>
      <Form
        aria-label="Request"
        definition={definition}
        action={send}
        noValidate
      />
    </div>
  )
}

export default {
  title: 'UI / Form'
}
