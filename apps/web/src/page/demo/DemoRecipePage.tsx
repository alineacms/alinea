import {DemoRecipe} from '@/schema'
import {Entry} from 'alinea/core/Entry'
import {Graph} from 'alinea/core/Graph'
import {DemoHeader} from './layout/DemoHeader'
import {DemoLayout} from './layout/DemoLayout'
import {DemoPage} from './layout/DemoPage'
import {DemoText} from './layout/DemoText'
import {DemoTypo} from './layout/DemoType'

export function DemoRecipePage({
  header,
  title,
  intro,
  ingredients,
  instructions
}: Awaited<ReturnType<typeof DemoRecipePage.query>>) {
  return (
    <DemoLayout>
      <DemoHeader {...header} />

      <DemoPage>
        <DemoPage.Container>
          <DemoTypo.H1>{title}</DemoTypo.H1>
          <DemoText doc={intro} />

          <section>
            <DemoTypo.H2>Ingredients</DemoTypo.H2>
            <DemoText doc={ingredients} />
          </section>

          <section>
            <DemoTypo.H2>Instructions</DemoTypo.H2>
            <DemoText doc={instructions} />
          </section>
        </DemoPage.Container>
      </DemoPage>
    </DemoLayout>
  )
}

DemoRecipePage.query = async (graph: Graph, entry: Entry) => {
  return graph.get({
    type: DemoRecipe,
    preview: {entry},
    filter: {_path: entry.path}
  })
}
