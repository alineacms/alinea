import type {FormDefinition} from '#/field/form/FormDefinition.js'
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

export default {
  title: 'UI / Form'
}
