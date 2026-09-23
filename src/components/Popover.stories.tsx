import {useRef, useState} from 'react'
import {IcRoundSearch} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger
} from './Popover.js'

export function Example() {
  return (
    <Popover>
      <PopoverTrigger variant="outline" icon={IcRoundSearch}>
        Help
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" aria-label="Help">
        <p>For help accessing your account, please contact support.</p>
      </PopoverContent>
    </Popover>
  )
}

export function NonModal() {
  return (
    <Popover modal={false}>
      <PopoverTrigger>Open without blocking the page</PopoverTrigger>
      <PopoverContent side="right" aria-label="Details">
        <p>The rest of the page stays interactive.</p>
      </PopoverContent>
    </Popover>
  )
}

export function Anchored() {
  return (
    <div style={{padding: 24}}>
      <Popover>
        <PopoverAnchor
          style={{width: 240, padding: 8, border: '1px dashed gray'}}
          data-testid="anchor"
        >
          <PopoverTrigger>Open below the box</PopoverTrigger>
        </PopoverAnchor>
        <PopoverContent side="bottom" align="start" aria-label="Anchored">
          <p>Positioned against the anchor.</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function VirtualAnchor() {
  const anchor = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <div style={{padding: 24}}>
      <Button onClick={() => setOpen(true)}>Open elsewhere</Button>
      <div
        ref={anchor}
        data-testid="anchor"
        style={{marginTop: 120, width: 200, border: '1px dashed gray'}}
      >
        Anchor
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor virtualRef={anchor} />
        <PopoverContent side="bottom" aria-label="Virtual">
          <p>Positioned against an element rendered elsewhere.</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function KeepOpen() {
  const [outside, setOutside] = useState(0)
  return (
    <div style={{padding: 24}}>
      <Popover modal={false}>
        <PopoverTrigger>Stays open</PopoverTrigger>
        <PopoverContent
          side="right"
          aria-label="Sticky"
          onInteractOutside={event => {
            event.preventDefault()
            setOutside(count => count + 1)
          }}
        >
          <p>Only closes with its trigger.</p>
        </PopoverContent>
      </Popover>
      <p data-testid="outside">{outside}</p>
    </div>
  )
}

export default {
  title: 'Pure components / Popover'
}
