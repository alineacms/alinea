import type {TextDoc} from 'alinea'
import {Node} from 'alinea/core/TextDoc'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {ImageBlockView} from '@/blocks/image/ImageBlock'
import {TextBlockView} from '@/blocks/text/TextBlock'
import {WeatherBlockView} from '@/blocks/weather/WeatherBlock'
import {cms} from '@/cms'
import {LandingPage} from './LandingPage.schema'

export async function LandingPageView() {
  const page = await cms.get({url: '/', type: LandingPage})
  if (!page) notFound()

  return (
    <main>
      <h1>{page.title}</h1>
      {page.blocks.map(block => {
        if (block._type === 'TextBlock')
          return <TextBlockView key={block._id} block={block} />
        if (block._type === 'ImageBlock')
          return <ImageBlockView key={block._id} block={block} />
        if (block._type === 'WeatherBlock')
          return <WeatherBlockView key={block._id} block={block} />
        return null
      })}
    </main>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await cms.get({url: '/', type: LandingPage})
  if (!page) return {}

  let fallbackDescription = ''
  for (const block of page.blocks) {
    if (block._type === 'TextBlock') {
      fallbackDescription = plainText(block.body)
      break
    }
  }

  return {
    title: page.metadata.title || page.title,
    description: page.metadata?.description || fallbackDescription,
    openGraph: {
      title: page.metadata.openGraph.title || page.metadata.title || page.title,
      description:
        page.metadata.openGraph.description || page.metadata?.description,
      images: page.metadata?.openGraph.image
        ? [page.metadata?.openGraph.image.src]
        : undefined
    }
  }
}

export function plainText(value: TextDoc<any> | string | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (!Array.isArray(value)) return ''
  const result = value
    .reduce((acc, node) => {
      return acc + textOf(node)
    }, '')
    .trim()
  return result.replace(/ +(?= )/g, '')
}

function textOf(node: Node): string {
  if (node._type === 'hardBreak') return '\n'
  if (Node.isText(node)) {
    return node.text ? ' ' + node.text : ''
  } else if (Node.isElement(node) && node.content) {
    return node.content.reduce((acc, node) => {
      return acc + textOf(node)
    }, '')
  }
  return ''
}
