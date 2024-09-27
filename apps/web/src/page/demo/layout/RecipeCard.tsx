import styler from '@alinea/styler'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import {ImageLink, TextDoc} from 'alinea'
import {HStack, Stack, VStack, imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import Link from 'next/link'
import {DemoText} from './DemoText'
import {DemoTypo} from './DemoType'
import css from './RecipeCard.module.scss'

const styles = styler(css)

export interface RecipeCardProps {
  title: string
  url: string
  header: {
    image?: ImageLink
    credit?: TextDoc
  }
  intro: TextDoc
}

export function RecipeCard(recipe: RecipeCardProps) {
  const image = recipe.header?.image
  const blurUrl = image && imageBlurUrl(image)
  return (
    <Link href={recipe.url}>
      <div className={styles.root()}>
        <header className={styles.root.header()}>
          {image && (
            <Image
              className={styles.root.header.image()}
              width={image.width}
              height={image.height}
              alt={image.title}
              src={image.src}
              sizes="375px"
              placeholder={blurUrl ? 'blur' : undefined}
              blurDataURL={blurUrl}
            />
          )}
        </header>
        <div className={styles.root.content()}>
          <DemoTypo>
            <DemoTypo.H2>{recipe.title}</DemoTypo.H2>
            <DemoText doc={recipe.intro} />
            <VStack>
              <Stack.Right>
                <div className={styles.root.content.link()}>
                  <HStack gap={8} center>
                    <span>Get baking</span>
                    <IcRoundArrowForward />
                  </HStack>
                </div>
              </Stack.Right>
            </VStack>
          </DemoTypo>
        </div>
      </div>
    </Link>
  )
}
