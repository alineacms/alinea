import 'alinea/theme.css'
import type {CSSProperties, ReactNode} from 'react'
import {
  RichText2EmptyStory,
  RichText2PlainStory,
  RichText2ReadOnlyStory,
  RichText2Story
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
      <RichText2Story />
    </StoryFrame>
  )
}

export function PlainText() {
  return (
    <StoryFrame>
      <RichText2PlainStory />
    </StoryFrame>
  )
}

export function Empty() {
  return (
    <StoryFrame>
      <RichText2EmptyStory />
    </StoryFrame>
  )
}

export function ReadOnly() {
  return (
    <StoryFrame>
      <RichText2ReadOnlyStory />
    </StoryFrame>
  )
}
