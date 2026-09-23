import {useState} from 'react'
import {IcRoundDescription} from '#/dashboard/icons.js'
import {TextField} from './TextField.js'

const column = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 420,
  padding: 24
} as const

export function Example() {
  const [name, setName] = useState('')
  return (
    <div style={column}>
      <TextField
        label="Name"
        placeholder="Your name"
        value={name}
        onValueChange={setName}
      />
      <output data-testid="name">{name}</output>
      <TextField label="Uncontrolled" defaultValue="Initial name" />
      <TextField
        label="With description"
        description="Shown next to the label."
        icon={IcRoundDescription}
        shared
      />
      <TextField type="email" label="Email" autoComplete="email" />
      <TextField type="password" label="Password" />
    </div>
  )
}

export function Multiline() {
  const [text, setText] = useState('Multi-line text input, used as textarea.')
  return (
    <div style={column}>
      <TextField
        multiline
        label="Grows with its content"
        value={text}
        onValueChange={setText}
      />
      <TextField multiline rows={4} label="At least four rows" />
    </div>
  )
}

export function States() {
  return (
    <div style={column}>
      <TextField
        required
        label="Username"
        error="Username already exists"
        defaultValue="alinea"
      />
      <TextField disabled label="Disabled" defaultValue="Disabled text" />
      <TextField readOnly label="Read-only" defaultValue="Read-only text" />
    </div>
  )
}

export default {
  title: 'Pure components / TextField'
}
