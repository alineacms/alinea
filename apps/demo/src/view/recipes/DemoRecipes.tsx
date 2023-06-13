import {Page} from '@alinea/generated'
import {fromModule} from 'alinea/ui'
import css from './DemoRecipes.module.scss'

const styles = fromModule(css)

export function DemoRecipes(props: Page.Recipes & {children: Page.Recipe[]}) {
  const {title, children} = props

  return <div className={styles.root()}>{JSON.stringify(props)}</div>
}
