import {DemoHome, DemoRecipe} from '@/schema'
import {Infer, Query} from 'alinea'
import {VStack, fromModule} from 'alinea/ui'
import css from './DemoHomePage.module.scss'
import {DemoHeader} from './layout/DemoHeader'
import {DemoLayout} from './layout/DemoLayout'
import {DemoPage} from './layout/DemoPage'
import {DemoText} from './layout/DemoText'
import {DemoTypo} from './layout/DemoType'
import {RecipeCard} from './layout/RecipeCard'

const styles = fromModule(css)

export function DemoHomePage({
  hero,
  recipes
}: Infer<typeof DemoHomePage.fragment>) {
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
              return <RecipeCard key={recipe.id} {...recipe} />
            })}
          </VStack>
        </DemoPage.Container>
      </DemoPage>
    </DemoLayout>
  )
}

DemoHomePage.fragment = Query(DemoHome)
  .select({
    hero: DemoHome.hero,
    recipes: Query(DemoRecipe).select({
      id: Query.id,
      url: Query.url,
      ...DemoRecipe
    })
  })
  .first()
