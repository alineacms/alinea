'use client'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Surface
} from 'alinea/components'
import {
  IcRoundFormatQuote,
  IcRoundImage,
  IcRoundNotes,
  IcRoundPanorama
} from 'alinea/dashboard/icons'

export function CommandExample() {
  return (
    <Surface style={{width: 280}}>
      <Command>
        <CommandInput aria-label="Search blocks" placeholder="Add a block…" />
        <CommandList aria-label="Blocks">
          <CommandEmpty>No matching blocks</CommandEmpty>
          <CommandGroup heading="Blocks">
            <CommandItem value="text" icon={IcRoundNotes}>
              Text
            </CommandItem>
            <CommandItem value="image" icon={IcRoundImage} keywords={['photo']}>
              Image
            </CommandItem>
            <CommandItem value="hero" icon={IcRoundPanorama}>
              Hero
            </CommandItem>
            <CommandItem value="quote" icon={IcRoundFormatQuote}>
              Quote
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Surface>
  )
}
