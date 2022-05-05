import {RichTextValue, TextDoc} from '@alinea/core'
import {Card, fromModule} from '@alinea/ui'
import {ReactNode, useMemo} from 'react'
import {ChangeBox} from './ChangeBox'
import {Change, diffList} from './Equals'
import {FieldsDiff} from './FieldsDiff'
import {ScalarDiff} from './ScalarDiff'
import css from './ScalarDiff.module.scss'

const styles = fromModule(css)

type Block = {
  id: string
  type: string
}

type Part = {type: 'text'; text: string} | {type: 'block'; block: Block}

type TextContent = {content: Array<TextContent | {text: string}>}

function contentToString({content}: TextContent): string {
  if (!content || !Array.isArray(content)) return ''
  return content
    .map(block => {
      if ('text' in block) return block.text + ' '
      return contentToString(block)
    })
    .join('')
}

function textDocParts(textDoc: TextDoc<any>): Array<Part> {
  const parts: Array<Part> = []
  let text = ''
  for (const block of textDoc) {
    switch (block.type) {
      case 'text':
        text += block.text + ' '
      default:
        const firstChar = block.type[0]
        if (!firstChar) continue
        const isCustomBlock = firstChar === firstChar.toUpperCase()
        if (isCustomBlock) {
          if (text) {
            parts.push({type: 'text', text})
            text = ''
          }
          parts.push({type: 'block', block: block as Block})
        } else {
          text += contentToString(block as TextContent)
        }
    }
  }
  if (text) parts.push({type: 'text', text})
  return parts
}

type RichTextChangeProps = {
  type: RichTextValue<any>
  change: Change<Part>
}

function RichTextChange({type, change}: RichTextChangeProps) {
  switch (change.type) {
    case 'unchanged':
      if (change.value.type === 'text' && change.old.type === 'text') {
        return (
          <ScalarDiff valueA={change.old.text} valueB={change.value.text} />
        )
      } else if (change.value.type === 'block' && change.old.type === 'block') {
        const name = change.value.block.type
        const kind = type.values?.[name]
        if (kind)
          return (
            <FieldsDiff
              types={Object.entries(kind.shape)}
              targetA={change.old.block}
              targetB={change.value.block}
            />
          )
      }
    default:
      if (change.value.type === 'block') {
        const name = change.value.block.type
        const kind = type.values?.[name]
        if (!kind) return <div>No type found</div>
        return (
          <FieldsDiff
            types={Object.entries(kind.shape)}
            targetA={change.value.block}
            targetB={change.value.block}
          />
        )
      } else {
        return (
          <ScalarDiff valueA={change.value.text} valueB={change.value.text} />
        )
      }
  }
}

export type RichTextDiffProps = {
  type: RichTextValue<any>
  valueA: TextDoc<any>
  valueB: TextDoc<any>
}

export function RichTextDiff({type, valueA, valueB}: RichTextDiffProps) {
  const parts = useMemo(() => {
    return {a: textDocParts(valueA), b: textDocParts(valueB)}
  }, [valueA, valueB])
  const length = Math.max(parts.a.length, parts.b.length)
  const res: Array<ReactNode> = []
  const equals = (partA: Part, partB: Part) => {
    if (partA.type !== partA.type) return false
    if (partA.type === 'block' && partB.type === 'block')
      return partA.block.id === partB.block.id
    return true
  }
  const changes = diffList(parts.a, parts.b, equals)
  return (
    <Card.Root>
      {changes.map((change, i) => {
        return (
          <Card.Row key={i}>
            <ChangeBox change={change.type}>
              <RichTextChange type={type} change={change} />
            </ChangeBox>
          </Card.Row>
        )
      })}
    </Card.Root>
  )
}
