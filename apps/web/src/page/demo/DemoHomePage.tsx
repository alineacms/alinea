import {DemoHome, DemoRecipe} from '@/schema'
import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {Graph} from 'alinea/core/Graph'
import {VStack} from 'alinea/ui'
import css from './DemoHomePage.module.scss'
import {DemoHeader} from './layout/DemoHeader'
import {DemoLayout} from './layout/DemoLayout'
import {DemoPage} from './layout/DemoPage'
import {DemoText} from './layout/DemoText'
import {DemoTypo} from './layout/DemoType'
import {RecipeCard} from './layout/RecipeCard'

const styles = styler(css)

export function DemoHomePage({
  hero,
  recipes
}: Awaited<ReturnType<typeof DemoHomePage.query>>) {
  return (
    <DemoLayout>
      <DemoHeader {...hero.header} />
      <DemoPage>
        <DemoPage.Container>
          <section className={styles.root.intro()}>
            <DemoTypo.H1 className={styles.root.intro.title()}>
              {hero.title}
            </DemoTypo.H1>
            {hero.text && <DemoText doc={hero.text} />}
          </section>

          <VStack gap={20}>
            {recipes.map(recipe => {
              return <RecipeCard key={recipe._id} {...recipe} />
            })}
          </VStack>
        </DemoPage.Container>
      </DemoPage>
    </DemoLayout>
  )
}

DemoHomePage.query = async (graph: Graph, entry: Entry) => {
  return {
    hero: await graph.get({
      preview: {entry},
      type: DemoHome,
      select: DemoHome.hero
    }),
    recipes: await graph.find({
      type: DemoRecipe,
      filter: {
        _workspace: 'demo'
      }
    })
  }
}
