import {useState} from 'react'
import {IcRoundEdit, IcRoundMoreHoriz, LucideFile} from '../dashboard/icons.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {
  Page,
  PageActions,
  PageBack,
  PageContent,
  PageFooter,
  PageHeader,
  PageTitle
} from './Page.js'
import {Surface} from './Surface.js'
import {TextField} from './TextField.js'

export function Example() {
  return (
    <div
      style={{
        display: 'flex',
        height: 560,
        margin: 24,
        border: '1px solid var(--alinea-border)',
        borderRadius: 8,
        overflow: 'hidden'
      }}
    >
      <Page>
        <PageHeader>
          <PageTitle>Launching the new platform</PageTitle>
          <PageActions>
            <Button
              variant="ghost"
              size="icon"
              icon={IcRoundMoreHoriz}
              aria-label="More actions"
            />
            <Button color="primary">Publish</Button>
          </PageActions>
        </PageHeader>
        <PageContent contained style={{padding: 16}}>
          <Surface
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: 16
            }}
          >
            <TextField
              label="Title"
              defaultValue="Launching the new platform"
            />
            <TextField label="Path" defaultValue="launching-the-new-platform" />
            {Array.from({length: 12}, (_, index) => (
              <TextField key={index} label={`Field ${index + 1}`} />
            ))}
          </Surface>
        </PageContent>
        <PageFooter>
          <Button variant="ghost" style={{marginLeft: 'auto'}}>
            Cancel
          </Button>
          <Button color="primary">Save</Button>
        </PageFooter>
      </Page>
    </div>
  )
}

export function EditorHeader() {
  const [log, setLog] = useState('')
  return (
    <div style={{margin: 24, border: '1px solid var(--alinea-border)'}}>
      <PageHeader size="lg">
        <PageBack label="Back to parent" onClick={() => setLog('back')} />
        <PageTitle>Launching the new platform</PageTitle>
        <Badge icon={IcRoundEdit} status="draft">
          Draft
        </Badge>
        <Badge icon={LucideFile}>Article</Badge>
        <PageActions>
          <Button color="primary">Publish</Button>
        </PageActions>
      </PageHeader>
      {log && <p style={{padding: 16}}>Pressed {log}</p>}
    </div>
  )
}

export default {
  title: 'Pure components / Page'
}
