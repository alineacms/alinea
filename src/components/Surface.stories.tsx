import {Button} from './Button.js'
import {Surface, SurfaceContent, SurfaceHeader, SurfaceRow} from './Surface.js'
import {TextField} from './TextField.js'

export function Basic() {
  return (
    <div style={{display: 'grid', gap: 24, maxWidth: 720, padding: 24}}>
      <Surface aria-label="Workspace settings" role="region">
        <SurfaceHeader>
          <strong>Workspace settings</strong>
        </SurfaceHeader>
        <SurfaceContent>
          <TextField label="Name" defaultValue="Editorial" />
          <TextField
            label="Description"
            defaultValue="Shared content workspace"
          />
        </SurfaceContent>
      </Surface>
      <Surface aria-label="Muted surface" depth="muted" role="region">
        <SurfaceContent>
          An explicit depth sets a muted background.
        </SurfaceContent>
      </Surface>
    </div>
  )
}

export function Nested() {
  return (
    <div style={{maxWidth: 720, padding: 24}}>
      <Surface aria-label="Base surface" role="region">
        <SurfaceHeader>
          <strong>Base surface</strong>
        </SurfaceHeader>
        <SurfaceContent>
          <Surface aria-label="Nested surface" role="region">
            <SurfaceContent>
              Nested surfaces keep the base background.
              <Surface aria-label="Deeper surface" role="region">
                <SurfaceContent>So does a deeper surface.</SurfaceContent>
              </Surface>
            </SurfaceContent>
          </Surface>
        </SurfaceContent>
      </Surface>
    </div>
  )
}

const rows = ['Hero', 'Quote', 'Gallery']

export function Rows() {
  return (
    <div style={{maxWidth: 720, padding: 24}}>
      <Surface aria-label="Sections" role="list">
        {rows.map(row => (
          <SurfaceRow aria-label={row} key={row} role="listitem">
            <strong style={{flex: '1 1 auto'}}>{row}</strong>
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          </SurfaceRow>
        ))}
      </Surface>
    </div>
  )
}

export default {title: 'Pure components / Surface'}
