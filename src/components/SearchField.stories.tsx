import {useState} from 'react'
import {IcRoundSearch} from '#/dashboard/icons.js'
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

const fruits = ['Apple', 'Banana', 'Cherry']

/** A search field that controls a list of results with the arrow keys */
export function Combobox() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = fruits.filter(fruit =>
    fruit.toLowerCase().includes(query.toLowerCase())
  )
  const expanded = Boolean(query) && results.length > 0
  return (
    <div style={column}>
      <SearchField
        aria-label="Fruit"
        icon={IcRoundSearch}
        value={query}
        onValueChange={value => {
          setQuery(value)
          setActive(0)
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown')
            setActive(Math.min(results.length - 1, active + 1))
          if (event.key === 'ArrowUp') setActive(Math.max(0, active - 1))
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={expanded ? 'fruits' : undefined}
        aria-activedescendant={expanded ? `fruit-${active}` : undefined}
      />
      {expanded && (
        <ul id="fruits" role="listbox" aria-label="Fruits">
          {results.map((fruit, index) => (
            <li
              key={fruit}
              id={`fruit-${index}`}
              role="option"
              aria-selected={index === active}
            >
              {fruit}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default {
  title: 'Pure components / SearchField'
}
