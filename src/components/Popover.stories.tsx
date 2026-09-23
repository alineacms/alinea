import {IcRoundSearch} from '../dashboard/icons.js'
import {Popover, PopoverContent, PopoverTrigger} from './Popover.js'

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

export default {
  title: 'Pure components / Popover'
}
