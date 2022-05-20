import {RichTextShape, TextDoc} from '@alinea/core'
import {RecordShape} from '@alinea/core/shape/RecordShape'
import {Card, fromModule} from '@alinea/ui'
import {ReactNode, useMemo} from 'react'
import {ChangeBox} from './ChangeBox'
import {diffList, diffRecord} from './DiffUtils'
import {FieldsDiff} from './FieldsDiff'
import {ScalarDiff} from './ScalarDiff'
import css from './ScalarDiff.module.scss'

const styles = fromModule(css)

type Block = {
  id: string
  type: string
}

type Part = {type: 'text'; text: string} | {type: 'block'; block: Block}

type TextContent = {type?: string; content: Array<TextContent | {text: string}>}

const blockTypes = new Set(['heading', 'paragraph', 'listItem'])

function contentToString({type, content}: TextContent): string {
  const withNewLine = blockTypes.has(type!)
  if (!content || !Array.isArray(content)) return ''
  return (
    content
      .map(block => {
        if ('text' in block) return block.text + ' '
        return contentToString(block)
      })
      .join('') + (withNewLine ? '\n\n' : '')
  )
}

function textDocParts(textDoc: TextDoc<any>): Array<Part> {
  const parts: Array<Part> = []
  let text = ''
  if (!Array.isArray(textDoc)) return parts
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

export type RichTextDiffProps = {
  shape: RichTextShape<any>
  valueA: TextDoc<any>
  valueB: TextDoc<any>
}

export function RichTextDiff({shape, valueA, valueB}: RichTextDiffProps) {
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
        switch (change.value.type) {
          case 'block': {
            const name = change.value.block.type
            const kind = shape.values?.[name]
            const compare =
              change.type === 'unchanged'
                ? [
                    ('block' in change.old && change.old.block) || {},
                    change.value.block
                  ]
                : change.type === 'removal'
                ? [change.value.block, {}]
                : [{}, change.value.block]
            const changes = diffRecord(
              kind as RecordShape,
              compare[0],
              compare[1]
            )
            if (changes.length === 0)
              return <ChangeBox change="equal" key={i} />
            return (
              <ChangeBox change={change.type} key={i}>
                <FieldsDiff
                  changes={changes}
                  targetA={compare[0]}
                  targetB={compare[1]}
                />
              </ChangeBox>
            )
          }
          case 'text': {
            const compare =
              change.type === 'unchanged'
                ? ['text' in change.old && change.old.text, change.value.text]
                : change.type === 'removal'
                ? [change.value.text, '']
                : ['', change.value.text]
            if (compare[0] === compare[1])
              return <ChangeBox change="equal" key={i} />
            return (
              <ChangeBox change={change.type} key={i}>
                <ScalarDiff valueA={compare[0]} valueB={compare[1]} />
              </ChangeBox>
            )
          }
        }
      })}
    </Card.Root>
  )
}
