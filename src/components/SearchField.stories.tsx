import {useState} from 'react'
import {IcRoundSearch} from '../dashboard/icons.js'
import {SearchField} from './SearchField.js'

const column = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 360,
  padding: 24
} as const

export function Example() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  return (
    <div style={column}>
      <SearchField
        aria-label="Search"
        placeholder="Search..."
        icon={IcRoundSearch}
        value={query}
        onValueChange={setQuery}
        onSubmit={setSubmitted}
        onClear={() => setSubmitted('cleared')}
      />
      <output data-testid="query">{query}</output>
      <output data-testid="submitted">{submitted}</output>
    </div>
  )
}

export function States() {
  return (
    <div style={column}>
      <SearchField
        aria-label="Loading"
        placeholder="Search..."
        icon={IcRoundSearch}
        loading
      />
      <SearchField
        label="With label"
        description="Lorem ipsum dolor sit amet."
      />
      <SearchField label="Invalid" error="This field is invalid." />
      <SearchField disabled label="Disabled" defaultValue="Disabled text" />
      <SearchField readOnly label="Read-only" defaultValue="Read-only text" />
    </div>
  )
}

export default {
  title: 'Pure components / SearchField'
}
