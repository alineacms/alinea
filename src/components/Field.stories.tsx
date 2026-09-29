import {Input, TextField as AriaTextField} from 'react-aria-components'
import {IcRoundDescription} from '#/dashboard/icons.js'
import {Field} from './Field.js'

const column = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  maxWidth: 420,
  padding: 24
} as const

export function Example() {
  return (
    <div style={column}>
      <Field
        label="Title"
        description="Shown in search results."
        icon={IcRoundDescription}
        shared
        htmlFor="field-title"
      >
        <input id="field-title" />
      </Field>
      <Field label="Slug" required htmlFor="field-slug">
        <input id="field-slug" />
      </Field>
      <Field label="Summary" disabled htmlFor="field-summary">
        <input id="field-summary" disabled />
      </Field>
    </div>
  )
}

/** A react-aria field links the description and error to its control */
export function Invalid() {
  return (
    <div style={column}>
      <AriaTextField isInvalid>
        <Field
          label="Email"
          description="Used to sign in."
          error="Enter a valid email address"
        >
          <Input />
        </Field>
      </AriaTextField>
    </div>
  )
}

export default {
  title: 'Pure components / Field'
}
