import css from './DemoRecipes.module.scss'

import {fromModule} from '@alinea/ui'
import {RecipeSchema} from '../recipe/Recipe.schema'
import {DemoRecipesSchema} from './DemoRecipes.schema'

const styles = fromModule(css)

export function DemoRecipes(
  props: DemoRecipesSchema & {children: RecipeSchema[]}
) {
  const {title, children} = props

  return <div className={styles.root()}>{JSON.stringify(props)}</div>
}
