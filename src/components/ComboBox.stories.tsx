import {useState} from 'react'
import {useAsyncList} from './AsyncList.js'
import {ComboBox, ComboBoxGroup, ComboBoxItem} from './ComboBox.js'

const software = [
  {value: 'photoshop', label: 'Adobe Photoshop'},
  {value: 'xd', label: 'Adobe XD'},
  {value: 'figma', label: 'Figma'},
  {value: 'invision', label: 'InVision'},
  {value: 'sketch', label: 'Sketch'}
]

export function Example() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <ComboBox
        label="Design software"
        placeholder="Search software"
        value={value}
        onValueChange={setValue}
        emptyMessage="No software found"
      >
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <p data-testid="value">Value: {value ?? 'none'}</p>
    </div>
  )
}

export function CustomValue() {
  const [inputValue, setInputValue] = useState('')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <ComboBox
        label="Tag"
        description="Type a new tag or pick an existing one"
        allowsCustomValue
        inputValue={inputValue}
        onInputValueChange={setInputValue}
      >
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <p data-testid="input">Input: {inputValue}</p>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <ComboBox label="Default value" defaultValue="figma">
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <ComboBox label="Disabled" disabled defaultValue="figma">
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <ComboBox label="Disabled items">
        {software.map((item, i) => (
          <ComboBoxItem
            key={item.value}
            value={item.value}
            disabled={i % 2 === 1}
          >
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <ComboBox label="Invalid" required error="Please select an item.">
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
    </div>
  )
}

export default {
  title: 'Pure components / ComboBox'
}

/** Items come from a (simulated) server that filters on the typed text */
export function ServerSearch() {
  const list = useAsyncList<{value: string; label: string}>({
    getKey: item => item.value,
    async load({filterText, signal}) {
      await new Promise(resolve => setTimeout(resolve, 300))
      signal.throwIfAborted()
      const query = filterText.toLowerCase()
      return {
        items: software.filter(item => item.label.toLowerCase().includes(query))
      }
    }
  })
  return (
    <ComboBox
      label="Design software"
      placeholder="Search software"
      inputValue={list.filterText}
      onInputValueChange={list.setFilterText}
      filter={false}
      loading={list.loading}
      emptyMessage="No software found"
    >
      {list.items.map(item => (
        <ComboBoxItem key={item.value} value={item.value}>
          {item.label}
        </ComboBoxItem>
      ))}
    </ComboBox>
  )
}

export function Groups() {
  return (
    <ComboBox
      label="Entry type"
      placeholder="Search types"
      style={{width: 280}}
    >
      <ComboBoxGroup label="Pages">
        <ComboBoxItem value="page" description="A plain page">
          Page
        </ComboBoxItem>
        <ComboBoxItem value="landing" description="A page built from blocks">
          Landing page
        </ComboBoxItem>
      </ComboBoxGroup>
      <ComboBoxGroup label="Blog">
        <ComboBoxItem value="post" description="An article in the blog">
          Blog post
        </ComboBoxItem>
      </ComboBoxGroup>
    </ComboBox>
  )
}
