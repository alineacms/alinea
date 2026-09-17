import type {Infer} from 'alinea'
import {RichText} from 'alinea/ui'
import NextLink from 'next/link'
import type {TextBlock} from './TextBlock.schema'

type TextBlockData = Infer.ListItem<typeof TextBlock>

function Link({href, ...props}: {href?: string; [key: string]: any}) {
  if (!href) return <a {...props} />
  return <NextLink href={href!} {...props} />
}

export function TextBlockView({block}: {block: TextBlockData}) {
  return <RichText doc={block.body} a={Link} />
}
