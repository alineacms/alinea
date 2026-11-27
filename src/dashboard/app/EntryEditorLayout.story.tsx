import {
  Button,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetSection,
  SheetTitle,
  TextField
} from '#/components.js'
import {useState} from 'react'
import {BlockSheet, BlockSheetProvider, useBlockSheet} from './BlockSheet.js'
import {EntryEditorLayout} from './EntryEditorLayout.js'

export function EntryEditorLayoutStory() {
  const [preview, setPreview] = useState(true)
  return (
    <div style={{display: 'flex', height: 600}}>
      <BlockSheetProvider>
        <EntryEditorLayout sidebar={preview && <p>Preview</p>}>
          <Button onClick={() => setPreview(!preview)}>Toggle preview</Button>
          <Row />
        </EntryEditorLayout>
      </BlockSheetProvider>
    </div>
  )
}

function Row() {
  const sheet = useBlockSheet('row')
  return (
    <>
      <Button {...sheet.triggerProps} onClick={sheet.toggle}>
        Edit row
      </Button>
      <BlockSheet id="row">
        <SheetContent onClose={() => sheet.setOpen(false)}>
          <SheetHeader>
            <SheetTitle>Row</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <SheetSection>
              <TextField label="Label" />
            </SheetSection>
          </SheetBody>
        </SheetContent>
      </BlockSheet>
    </>
  )
}
