import {Button} from './Button.js'
import {Surface, SurfaceContent, SurfaceHeader, SurfaceRow} from './Surface.js'
import {TextField} from './TextField.js'

export function Basic() {
  return (
    <div style={{display: 'grid', gap: 24, maxWidth: 720}}>
      <Surface>
        <SurfaceHeader>
          <strong>Workspace settings</strong>
        </SurfaceHeader>
        <SurfaceContent>
          <TextField label="Name" value="Editorial" />
          <TextField label="Description" value="Shared content workspace" />
        </SurfaceContent>
      </Surface>

      <Surface depth="muted">
        <SurfaceContent>
          Explicit muted surfaces can be used where the surrounding depth should
          not decide the background.
        </SurfaceContent>
      </Surface>
    </div>
  )
}

export function Nested() {
  return (
    <Surface>
      <SurfaceHeader>
        <strong>Base surface</strong>
      </SurfaceHeader>
      <SurfaceContent>
        <Surface>
          <SurfaceContent>
            Nested surfaces default to the muted background.
            <Surface>
              <SurfaceContent>
                A deeper surface alternates back to the base background.
              </SurfaceContent>
            </Surface>
          </SurfaceContent>
        </Surface>
      </SurfaceContent>
    </Surface>
  )
}

export function Rows() {
  return (
    <div style={{display: 'grid', gap: 24, maxWidth: 720}}>
      <Surface role="list">
        <SurfaceRow role="listitem">
          <strong style={{flex: '1 1 auto'}}>Hero</strong>
          <Button appearance="plain" size="small">
            Edit
          </Button>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <strong style={{flex: '1 1 auto'}}>Quote</strong>
          <Button appearance="plain" size="small">
            Edit
          </Button>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <strong style={{flex: '1 1 auto'}}>Gallery</strong>
          <Button appearance="plain" size="small">
            Edit
          </Button>
        </SurfaceRow>
      </Surface>

      <Surface role="list" aria-label="Detailed rows">
        <SurfaceRow role="listitem">
          <div style={{display: 'grid', gap: 4, flex: '1 1 auto'}}>
            <strong>First row</strong>
            <span>Rows can hold more than one line of content.</span>
          </div>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <div style={{display: 'grid', gap: 4, flex: '1 1 auto'}}>
            <strong>Second row</strong>
            <span>The same primitive keeps one bordered list shape.</span>
          </div>
        </SurfaceRow>
      </Surface>
    </div>
  )
}

export function NestedLists() {
  return (
    <div style={{display: 'grid', gap: 24, maxWidth: 720}}>
      <Surface role="list">
        <SurfaceRow role="listitem">
          <strong style={{flex: '1 1 auto'}}>Landing page</strong>
          <Button appearance="plain" size="small">
            Edit
          </Button>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <div style={{display: 'grid', gap: 12, flex: '1 1 auto'}}>
            <strong>Sections</strong>
            <Surface role="list">
              <SurfaceRow role="listitem">
                <span style={{flex: '1 1 auto'}}>Hero</span>
                <Button appearance="plain" size="small">
                  Edit
                </Button>
              </SurfaceRow>
              <SurfaceRow role="listitem">
                <span style={{flex: '1 1 auto'}}>Feature grid</span>
                <Button appearance="plain" size="small">
                  Edit
                </Button>
              </SurfaceRow>
              <SurfaceRow role="listitem">
                <span style={{flex: '1 1 auto'}}>Call to action</span>
                <Button appearance="plain" size="small">
                  Edit
                </Button>
              </SurfaceRow>
            </Surface>
          </div>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <strong style={{flex: '1 1 auto'}}>SEO metadata</strong>
          <Button appearance="plain" size="small">
            Edit
          </Button>
        </SurfaceRow>
      </Surface>

      <Surface role="list" aria-label="Nested content rows">
        <SurfaceRow role="listitem">
          <strong>Navigation</strong>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <div style={{display: 'grid', gap: 12, flex: '1 1 auto'}}>
            <strong>Content blocks</strong>
            <Surface role="list" aria-label="Content block rows">
              <SurfaceRow role="listitem">Hero block</SurfaceRow>
              <SurfaceRow role="listitem">Gallery block</SurfaceRow>
              <SurfaceRow role="listitem">Quote block</SurfaceRow>
            </Surface>
          </div>
        </SurfaceRow>
        <SurfaceRow role="listitem">
          <strong>Footer</strong>
        </SurfaceRow>
      </Surface>
    </div>
  )
}

export default {title: 'Components / Surface'}
