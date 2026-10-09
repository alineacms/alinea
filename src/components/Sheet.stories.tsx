import {type CSSProperties, useState} from 'react'
import {
  IcBaselineContentCopy,
  IcRoundDelete,
  IcRoundPanorama
} from '#/dashboard/icons.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {Kbd} from './Kbd.js'
import {
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle
} from './Sheet.js'
import {TextField} from './TextField.js'

const frameStyle: CSSProperties = {
  position: 'relative',
  width: 360,
  height: 600,
  border: '1px solid var(--alinea-border)'
}

export function Example() {
  const [open, setOpen] = useState(true)
  return (
    <div style={{display: 'flex', gap: 16, alignItems: 'start'}}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reopen
      </Button>
      <div style={frameStyle}>
        {open && (
          <SheetContent
            backLabel="Back to preview"
            onClose={() => setOpen(false)}
          >
            <SheetHeader>
              <Badge icon={IcRoundPanorama} size="sm">
                Hero
              </Badge>
              <SheetTitle>Landing page intro</SheetTitle>
              <Kbd size="sm" aria-hidden>
                Esc
              </Kbd>
              <SheetClose aria-label="Close block settings" />
            </SheetHeader>
            <SheetBody>
              <SheetSection title="Block">
                <TextField label="Label" defaultValue="Landing page intro" />
              </SheetSection>
              <SheetSection title="Anchor">
                <TextField label="Anchor" defaultValue="landing-page-intro" />
              </SheetSection>
            </SheetBody>
            <SheetFooter>
              <Button variant="ghost" size="sm" icon={IcBaselineContentCopy}>
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                color="destructive"
                icon={IcRoundDelete}
              >
                Delete
              </Button>
            </SheetFooter>
          </SheetContent>
        )}
      </div>
    </div>
  )
}

export default {
  title: 'Pure components / Sheet'
}
