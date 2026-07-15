import 'alinea/theme.css'
import type {CSSProperties, ReactNode} from 'react'
import {
  RichTextEmptyStory,
  RichTextPlainStory,
  RichTextReadOnlyStory,
  RichTextStory
} from './RichTextField.story.js'

const storyStyle: CSSProperties = {
  width: 'min(920px, 100%)',
  padding: 24
}

interface StoryFrameProps {
  children: ReactNode
}

function StoryFrame({children}: StoryFrameProps) {
  return <main style={storyStyle}>{children}</main>
}

export function Blocks() {
  return (
    <StoryFrame>
      <RichTextStory />
    </StoryFrame>
  )
}

export function PlainText() {
  return (
    <StoryFrame>
      <RichTextPlainStory />
    </StoryFrame>
  )
}

export function Empty() {
  return (
    <StoryFrame>
      <RichTextEmptyStory />
    </StoryFrame>
  )
}

export function ReadOnly() {
  return (
    <StoryFrame>
      <RichTextReadOnlyStory />
    </StoryFrame>
  )
}
