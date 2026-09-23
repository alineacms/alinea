import {useState} from 'react'
import {
  IcRoundFormatAlignCenter,
  IcRoundFormatAlignLeft,
  IcRoundFormatAlignRight,
  IcRoundFormatBold,
  IcRoundFormatItalic,
  IcRoundStrikethroughS
} from '#/dashboard/icons.js'
import {ToggleGroup, ToggleGroupItem} from './ToggleGroup.js'

export function Single() {
  const [value, setValue] = useState('left')
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Alignment"
        value={value}
        onValueChange={setValue}
      >
        <ToggleGroupItem
          value="left"
          aria-label="Left"
          icon={IcRoundFormatAlignLeft}
        />
        <ToggleGroupItem
          value="center"
          aria-label="Center"
          icon={IcRoundFormatAlignCenter}
        />
        <ToggleGroupItem
          value="right"
          aria-label="Right"
          icon={IcRoundFormatAlignRight}
        />
      </ToggleGroup>
      <span>Alignment: {value || 'none'}</span>
    </div>
  )
}

export function Multiple() {
  const [value, setValue] = useState<Array<string>>(['bold'])
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <ToggleGroup
        type="multiple"
        aria-label="Formatting"
        value={value}
        onValueChange={setValue}
      >
        <ToggleGroupItem value="bold" icon={IcRoundFormatBold}>
          Bold
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" icon={IcRoundFormatItalic}>
          Italic
        </ToggleGroupItem>
        <ToggleGroupItem value="strike" icon={IcRoundStrikethroughS} disabled>
          Strikethrough
        </ToggleGroupItem>
      </ToggleGroup>
      <span>Formatting: {value.join(', ') || 'none'}</span>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      {(['sm', 'default', 'lg'] as const).map(size => (
        <ToggleGroup
          key={size}
          type="single"
          variant="outline"
          size={size}
          defaultValue="a"
          aria-label={`Size ${size}`}
        >
          <ToggleGroupItem value="a">First</ToggleGroupItem>
          <ToggleGroupItem value="b">Second</ToggleGroupItem>
        </ToggleGroup>
      ))}
      <ToggleGroup
        type="single"
        orientation="vertical"
        variant="outline"
        defaultValue="a"
        aria-label="Vertical"
      >
        <ToggleGroupItem value="a">Top</ToggleGroupItem>
        <ToggleGroupItem value="b">Bottom</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

export default {
  title: 'Pure components / ToggleGroup'
}
