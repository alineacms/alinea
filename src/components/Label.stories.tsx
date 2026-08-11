import type {CSSProperties, ReactNode} from 'react'
import {TextField} from './TextField.js'

const storyStyle: CSSProperties = {
  width: 360,
  padding: 24,
  display: 'grid',
  gap: 18
}

interface StorySectionProps {
  children: ReactNode
  title: string
}

function StorySection({children, title}: StorySectionProps) {
  return (
    <section>
      <h2
        style={{
          margin: '0 0 8px',
          color: 'var(--alinea-fg-muted)',
          fontSize: 'var(--alinea-font-size-base)',
          fontWeight: 500,
          lineHeight: 1
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Example() {
  return (
    <div style={storyStyle}>
      <StorySection title="Default">
        <TextField label="Title" placeholder="Entry title" />
      </StorySection>
      <StorySection title="Shared field">
        <TextField
          label="Title"
          placeholder="Shared title"
          shared
          description="Used across all language versions."
        />
      </StorySection>
    </div>
  )
}

export default {
  title: 'Components / Label'
}
