import {useState} from 'react'
import {IcRoundDelete, IcRoundSave} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {Tooltip, TooltipContent, TooltipTrigger} from './Tooltip.js'

export function Example() {
  return (
    <div style={{padding: 80}}>
      <Tooltip delayDuration={0}>
        <TooltipTrigger variant="outline">Hover me</TooltipTrigger>
        <TooltipContent>Add to library</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AsChild() {
  return (
    <div style={{display: 'flex', gap: 16, padding: 80}}>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            icon={IcRoundSave}
            aria-label="Save"
          />
        </TooltipTrigger>
        <TooltipContent>Save</TooltipContent>
      </Tooltip>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button type="button">Native button</button>
        </TooltipTrigger>
        <TooltipContent>Describes the native button</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function Sides() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, max-content)',
        gap: 48,
        padding: 80
      }}
    >
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <Tooltip key={side} delayDuration={0}>
          <TooltipTrigger variant="outline">{side}</TooltipTrigger>
          <TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(true)
  return (
    <div style={{display: 'flex', gap: 16, padding: 80}}>
      <Button onClick={() => setOpen(!open)}>
        {open ? 'Hide tooltip' : 'Show tooltip'}
      </Button>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          variant="outline"
          icon={IcRoundDelete}
          aria-label="Delete"
        />
        <TooltipContent side="right">Cannot be undone</TooltipContent>
      </Tooltip>
    </div>
  )
}

export default {
  title: 'Pure components / Tooltip'
}
