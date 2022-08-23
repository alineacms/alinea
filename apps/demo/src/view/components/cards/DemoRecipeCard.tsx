import css from './DemoRecipeCard.module.scss'

import {fromModule, RichText} from '@alinea/ui'
import {DemoRecipedetailSchema} from '../../channels/recipedetail/DemoRecipedetail.schema'
import {DemoImage} from '../../layout/DemoImage'
import {DemoLink} from '../../layout/DemoLink'
import {DemoTitle} from '../../layout/DemoTitle'

const styles = fromModule(css)

export function DemoRecipeCard({
  url,
  image,
  title,
  intro
}: DemoRecipedetailSchema) {
  return (
    <DemoLink to={url} className={styles.root()}>
      <div className={styles.root.image()}>
        <DemoImage
          {...image}
          layout="fill"
          className={styles.root.image.bg()}
        />
      </div>
      <div className={styles.root.content()}>
        <DemoTitle.H3>{title}</DemoTitle.H3>
        {intro && (
          <div className={styles.root.content.text()}>
            <RichText doc={intro} />
          </div>
        )}
      </div>
    </DemoLink>
  )
}
