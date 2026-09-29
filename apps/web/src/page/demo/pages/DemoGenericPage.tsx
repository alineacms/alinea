import type {Graph} from 'alinea/core/Graph'
import {DemoPage} from '@/schema/demo'
import {type DemoTarget, targetLocale, targetQuery} from '../demoData'
import {DemoBlocks, type DemoBlocksProps} from '../site/DemoBlocks'
import {DemoPageIntro} from '../site/DemoPageIntro'

export interface DemoGenericPageProps extends DemoBlocksProps {
  title: string
  intro: string
}

export function DemoGenericPage({
  title,
  intro,
  ...blocks
}: DemoGenericPageProps) {
  // Pages that open with a full width hero leave the title to the hero
  const opensWithHero = blocks.blocks?.[0]?._type === 'DemoHeroBlock'
  return (
    <>
      {!opensWithHero && <DemoPageIntro title={title} intro={intro} />}
      <DemoBlocks {...blocks} />
    </>
  )
}

DemoGenericPage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoGenericPageProps> => {
  const page = await graph.get({
    ...targetQuery(target),
    type: DemoPage,
    select: {
      title: DemoPage.title,
      intro: DemoPage.intro,
      blocks: DemoPage.blocks
    }
  })
  const blocks = await DemoBlocks.query(
    graph,
    page.blocks,
    targetLocale(target)
  )
  return {title: page.title, intro: page.intro, ...blocks}
}
