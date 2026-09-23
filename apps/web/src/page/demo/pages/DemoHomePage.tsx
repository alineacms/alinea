import type {Graph} from 'alinea/core/Graph'
import {DemoHome} from '@/schema/demo'
import {type DemoTarget, targetLocale, targetQuery} from '../demoData'
import {DemoBlocks, type DemoBlocksProps} from '../site/DemoBlocks'

export interface DemoHomePageProps extends DemoBlocksProps {}

export function DemoHomePage(props: DemoHomePageProps) {
  return <DemoBlocks {...props} />
}

DemoHomePage.query = async (
  graph: Graph,
  target: DemoTarget
): Promise<DemoHomePageProps> => {
  const blocks = await graph.get({
    ...targetQuery(target),
    type: DemoHome,
    select: DemoHome.blocks
  })
  return DemoBlocks.query(graph, blocks, targetLocale(target))
}
