import {Page} from 'alinea/content'
import {fromModule, VStack} from 'alinea/ui'
import {DemoHeader} from '../layout/DemoHeader'
import {DemoLayout} from '../layout/DemoLayout'
import {DemoPage} from '../layout/DemoPage'
import {DemoText} from '../layout/DemoText'
import {DemoTypo} from '../layout/DemoType'
import {RecipeCard} from '../layout/RecipeCard'
import css from './DemoHome.module.scss'

const styles = fromModule(css)

export function DemoHome({
  hero,
  recipes
}: Page.Home & {recipes: Page.Recipe[]}) {
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
