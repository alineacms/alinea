import '#/theme.css'
import {EditorContent, useEditor} from '@tiptap/react'
import type {CSSProperties} from 'react'
import {extensions} from './Extensions.js'
import {RichTextToolbar} from './RichTextToolbar.js'

const storyExtensions = Object.values(extensions)

const storyStyle: CSSProperties = {
  maxWidth: 920,
  padding: 24,
  display: 'grid',
  gap: 16
}

const toolbarFrameStyle: CSSProperties = {
  border: '1px solid var(--alinea-dashboard-surface-border)',
  borderRadius: 6,
  overflow: 'hidden',
  background: 'var(--alinea-bg)'
}

const editorStyle: CSSProperties = {
  border: '1px solid var(--alinea-dashboard-surface-border)',
  borderRadius: 6,
  padding: 16,
  background: 'var(--alinea-bg)'
}

interface ToolbarStoryProps {
  enableImages?: boolean
  enableTables?: boolean
}

function ToolbarStory({enableImages, enableTables}: ToolbarStoryProps) {
  const editor = useEditor({
    extensions: storyExtensions.filter(extension => {
      if (enableImages) return true
      return extension.name !== 'image'
    }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: {level: 2},
          content: [{type: 'text', text: 'Toolbar preview'}]
        },
        {
          type: 'paragraph',
          content: [
            {type: 'text', text: 'Select this text to try formatting actions.'}
          ]
        }
      ]
    }
  })
  if (!editor) return null
  return (
    <div style={storyStyle}>
      <div style={toolbarFrameStyle}>
        <RichTextToolbar
          editor={editor}
          enableImages={enableImages}
          enableTables={enableTables}
          ownerId="story"
          pickLink={() => Promise.resolve(undefined)}
          getEntryAnchors={() => []}
          onFocusChange={() => undefined}
        />
      </div>
      <div style={editorStyle}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export function Example() {
  return <ToolbarStory />
}

export function WithTables() {
  return <ToolbarStory enableTables />
}

export function WithImages() {
  return <ToolbarStory enableImages />
}
