import {useState} from 'react'
import {
  IcRoundAdd,
  IcRoundCode,
  IcRoundEdit,
  IcRoundFormatQuote,
  IcRoundImage,
  IcRoundLink,
  IcRoundPanorama
} from '#/dashboard/icons.js'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from './Command.js'
import {Popover, PopoverContent, PopoverTrigger} from './Popover.js'
import {Surface} from './Surface.js'

export function Example() {
  const [selected, setSelected] = useState<string>()
  return (
    <div style={{display: 'grid', gap: 12, width: 300}}>
      <Surface>
        <Command>
          <CommandInput aria-label="Search blocks" placeholder="Search..." />
          <CommandList aria-label="Blocks">
            <CommandEmpty>No matching blocks</CommandEmpty>
            <CommandGroup heading="Content">
              <CommandItem
                value="text"
                icon={IcRoundEdit}
                onSelect={setSelected}
              >
                Text
              </CommandItem>
              <CommandItem
                value="image"
                icon={IcRoundImage}
                keywords={['photo', 'picture']}
                onSelect={setSelected}
              >
                Image
              </CommandItem>
              <CommandItem
                value="quote"
                icon={IcRoundFormatQuote}
                onSelect={setSelected}
              >
                Quote
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Advanced">
              <CommandItem
                value="code"
                icon={IcRoundCode}
                onSelect={setSelected}
              >
                Code
              </CommandItem>
              <CommandItem
                value="embed"
                icon={IcRoundLink}
                disabled
                onSelect={setSelected}
              >
                Embed
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </Surface>
      <p data-testid="selected">{selected ?? 'Nothing selected'}</p>
    </div>
  )
}

const blocks = [
  {value: 'hero', label: 'Hero', icon: IcRoundPanorama},
  {value: 'text', label: 'Text', icon: IcRoundEdit},
  {value: 'image', label: 'Image', icon: IcRoundImage},
  {value: 'quote', label: 'Quote', icon: IcRoundFormatQuote},
  {value: 'code', label: 'Code', icon: IcRoundCode}
]

export function InPopover() {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState<Array<string>>([])
  function add(value: string) {
    setAdded(current => [...current, value])
    setOpen(false)
  }
  return (
    <div style={{display: 'grid', gap: 12, justifyItems: 'start'}}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger variant="outline" icon={IcRoundAdd}>
          Add block
        </PopoverTrigger>
        <PopoverContent aria-label="Add block" style={{padding: 0, width: 280}}>
          <Command>
            <CommandInput
              aria-label="Search types"
              autoFocus
              placeholder="Search types..."
            />
            <CommandList aria-label="Block types">
              <CommandEmpty>No matching types</CommandEmpty>
              {blocks.map(block => (
                <CommandItem
                  key={block.value}
                  value={block.value}
                  icon={block.icon}
                  onSelect={add}
                >
                  {block.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p data-testid="added">{added.join(', ') || 'No blocks'}</p>
    </div>
  )
}

export function CustomFilter() {
  return (
    <Surface style={{width: 300}}>
      <Command
        filter={(value, search) =>
          value.toLowerCase().startsWith(search.toLowerCase())
        }
      >
        <CommandInput aria-label="Search by id" placeholder="Id prefix..." />
        <CommandList aria-label="Blocks by id">
          <CommandEmpty>No block ids start with this</CommandEmpty>
          {blocks.map(block => (
            <CommandItem
              key={block.value}
              value={block.value}
              icon={block.icon}
            >
              {`${block.label} (${block.value})`}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </Surface>
  )
}

export default {
  title: 'Pure components / Command'
}
