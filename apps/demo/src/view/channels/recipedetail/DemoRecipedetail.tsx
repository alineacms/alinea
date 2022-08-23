import css from './DemoRecipedetail.module.scss'

import {fromModule, RichText} from '@alinea/ui'
import {MdiChefHat} from '../../../icons/MdiChefHat'
import {MdiClock} from '../../../icons/MdiClock'
import {DemoBlocks} from '../../blocks/DemoBlocks'
import {DemoRecipeCard} from '../../components/cards/DemoRecipeCard'
import {DemoHero} from '../../components/hero/DemoHero'
import {DemoContainer, DemoSmallContainer} from '../../layout/DemoContainer'
import {DemoImage} from '../../layout/DemoImage'
import {DemoTitle} from '../../layout/DemoTitle'
import {DemoRecipedetailSchema} from '../recipedetail/DemoRecipedetail.schema'

const styles = fromModule(css)

type RelatedProps = {
  related: DemoRecipedetailSchema[]
  category: string
}

export function DemoRecipedetail(props: DemoRecipedetailSchema & RelatedProps) {
  const {title, image, category, intro, blocks, related} = props

  return (
    <div className={styles.root()}>
      <DemoHero image={image} title={title} />
      <Intro image={image} category={category} intro={intro} />
      <DemoBlocks blocks={blocks} container={DemoSmallContainer} />
      <Related related={related} category={category} />
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
            {intro && intro?.length > 0 && (
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

function Related({related, category}: RelatedProps) {
  if (!related || related?.length < 1) return null

  return (
    <div className={styles.related()}>
      <DemoContainer>
        {category && (
          <DemoTitle.H2>Related by category: {category}</DemoTitle.H2>
        )}
        {!category && <DemoTitle.H2>Latest recipes</DemoTitle.H2>}
        <div className={styles.related.items()}>
          {related.map((item, i) => (
            <div className={styles.related.items.item()} key={i}>
              <DemoRecipeCard {...item} />
            </div>
          ))}
        </div>
      </DemoContainer>
    </div>
  )
}
