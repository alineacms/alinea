import {BlockNode, ElementNode, Node, type TextDoc} from 'alinea/core/TextDoc'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {RichTextShape} from 'alinea/core/shape/RichTextShape'
import {Sink} from 'alinea/ui/Sink'
import {ComponentType, ReactNode, useMemo} from 'react'
import {ChangeBox} from './ChangeBox.js'
import {diffList, diffRecord} from './DiffUtils.js'
import {FieldsDiffProps} from './FieldsDiff.js'
import {ScalarDiff} from './ScalarDiff.js'

type Part = {type: 'text'; text: string} | {type: 'block'; block: BlockNode}

const blockTypes = new Set(['heading', 'paragraph', 'listItem'])

function contentToString({_type: type, content}: ElementNode): string {
  const withNewLine = blockTypes.has(type!)
  if (!content || !Array.isArray(content)) return ''
  return (
    content
      .map(block => {
        if (Node.isText(block)) return block.text + ' '
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
    if (Node.isText(block)) {
      text += block.text + ' '
    } else if (Node.isElement(block)) {
      text += contentToString(block)
    } else if (Node.isBlock(block)) {
      if (text) {
        parts.push({type: 'text', text})
        text = ''
      }
      parts.push({type: 'block', block: block})
    }
  }
  if (text) parts.push({type: 'text', text})
  return parts
}

export type RichTextDiffProps = {
  FieldsDiff: ComponentType<FieldsDiffProps>
  shape: RichTextShape<any>
  valueA: TextDoc<any>
  valueB: TextDoc<any>
}

export function RichTextDiff({
  FieldsDiff,
  shape,
  valueA,
  valueB
}: RichTextDiffProps) {
  const parts = useMemo(() => {
    return {a: textDocParts(valueA), b: textDocParts(valueB)}
  }, [valueA, valueB])
  const length = Math.max(parts.a.length, parts.b.length)
  const res: Array<ReactNode> = []
  const equals = (partA: Part, partB: Part) => {
    if (partA.type !== partA.type) return false
    if (partA.type === 'block' && partB.type === 'block')
      return partA.block[BlockNode.id] === partB.block[BlockNode.id]
    return true
  }
  const changes = diffList(parts.a, parts.b, equals)
  return (
    <Sink.Root>
      {changes.map((change, i) => {
        switch (change.value.type) {
          case 'block': {
            const name = change.value.block[Node.type]
            const kind = shape.blocks?.[name]
            const compare =
              change.type === 'keep'
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
              change.type === 'keep'
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
    </Sink.Root>
  )
}
