import css from './DemoRecipes.module.scss'

import {fromModule} from '@alinea/ui'
import {DemoRecipeCard} from '../../components/cards/DemoRecipeCard'
import {DemoContainer} from '../../layout/DemoContainer'
import {DemoLayout} from '../../layout/DemoLayout'
import {DemoTitle} from '../../layout/DemoTitle'
import {DemoRecipedetailSchema} from '../recipedetail/DemoRecipedetail.schema'
import {DemoRecipesSchema} from './DemoRecipes.schema'

const styles = fromModule(css)

export function DemoRecipes(
  props: DemoRecipesSchema & {children: DemoRecipedetailSchema[]}
) {
  const {title, children} = props

  return (
    <DemoLayout>
      <div className={styles.root()}>
        <DemoContainer>
          <DemoTitle.H1>{title}</DemoTitle.H1>
          {children?.length > 0 && (
            <div className={styles.root.items()}>
              {children.map((item, i) => (
                <div className={styles.root.items.item()} key={i}>
                  <DemoRecipeCard {...item} />
                </div>
              ))}
            </div>
          )}
        </DemoContainer>
      </div>
    </DemoLayout>
  )
}
