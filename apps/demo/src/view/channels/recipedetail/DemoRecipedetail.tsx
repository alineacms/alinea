import css from './DemoRecipedetail.module.scss'

import {fromModule, RichText} from '@alinea/ui'
import {MdiChefHat} from '../../../icons/MdiChefHat'
import {MdiClock} from '../../../icons/MdiClock'
import {DemoHero} from '../../components/hero/DemoHero'
import {DemoContainer} from '../../layout/DemoContainer'
import {DemoImage} from '../../layout/DemoImage'
import {DemoRecipedetailSchema} from '../recipedetail/DemoRecipedetail.schema'

const styles = fromModule(css)

export function DemoRecipedetail(props: DemoRecipedetailSchema) {
  const {title, image, category, intro} = props
  return (
    <div className={styles.root()}>
      <DemoHero image={image} title={title} />
      <Intro image={image} category={category} intro={intro} />
    </div>
  )
}

function Intro({image, category, intro}: any) {
  return (
    <div className={styles.intro()}>
      <DemoContainer>
        <div className={styles.intro.row()}>
          {image?.src && (
            <div className={styles.intro.image()}>
              <DemoImage {...image} />
            </div>
          )}
          <div className={styles.intro.content()}>
            <div className={styles.intro.tags()}>
              {category && (
                <div className={styles.intro.tags.tag()}>
                  <span className={styles.intro.tags.tag.icon()}>
                    <MdiClock />
                  </span>
                  <p>{category}</p>
                </div>
              )}
              <div className={styles.intro.tags.tag()}>
                <span className={styles.intro.tags.tag.icon()}>
                  <MdiChefHat />
                </span>
                <p>50 mins</p>
              </div>
            </div>
            {intro && (
              <div className={styles.intro.text()}>
                <RichText doc={intro} />
              </div>
            )}
          </div>
        </div>
      </DemoContainer>
    </div>
  )
}
