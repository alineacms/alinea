import {useState} from 'react'
import {
  IcRoundBrightness2,
  IcRoundSearch,
  IcOutlineSettings
} from '../dashboard/icons.js'
import {Select, SelectGroup, SelectItem, SelectSeparator} from './Select.js'

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
      <Select
        label="Design software"
        description="Pick the tool you use most"
        placeholder="Select software"
        value={value}
        onValueChange={setValue}
      >
        {software.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </Select>
      <p data-testid="value">Value: {value ?? 'none'}</p>
    </div>
  )
}

export function Groups() {
  return (
    <Select label="Setting" placeholder="Select a setting">
      <SelectGroup label="Appearance">
        <SelectItem value="theme" icon={IcRoundBrightness2}>
          Theme
        </SelectItem>
        <SelectItem value="search" icon={IcRoundSearch}>
          Search
        </SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup label="System">
        <SelectItem
          value="settings"
          icon={IcOutlineSettings}
          description="Configure the workspace"
        >
          Settings
        </SelectItem>
        <SelectItem value="disabled" disabled>
          Unavailable
        </SelectItem>
      </SelectGroup>
    </Select>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Select label="Required" required defaultValue="figma">
        {software.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </Select>
      <Select label="Disabled" disabled defaultValue="figma">
        {software.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </Select>
      <Select label="Read only" readOnly defaultValue="sketch">
        {software.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </Select>
      <Select label="Invalid" error="Please select an item in the list.">
        {software.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}

export function LongList() {
  return (
    <Select label="Large option list" placeholder="Select an option">
      {Array.from({length: 1000}, (_, i) => (
        <SelectItem key={i} value={String(i + 1)}>
          {`Option ${i + 1}`}
        </SelectItem>
      ))}
    </Select>
  )
}

export default {
  title: 'Pure components / Select'
}
