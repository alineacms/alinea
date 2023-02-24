import {TextDoc} from 'alinea/core'
import {LinkData} from 'alinea/input/link'
import {fromModule, HStack, Stack, VStack} from 'alinea/ui'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import Image from 'next/image'
import Link from 'next/link'
import {DemoText} from './DemoText.js'
import {DemoTypo} from './DemoType.js'
import css from './RecipeCard.module.scss'

const styles = fromModule(css)

export interface RecipeCardProps {
  title: string
  url: string
  header: {
    image?: LinkData.Image
    credit?: TextDoc
  }
  intro: TextDoc
}

export function RecipeCard(recipe: RecipeCardProps) {
  const image = recipe.header.image
  if (!image?.src) return null
  return (
    <Link href={recipe.url}>
      <div className={styles.root()}>
        <header className={styles.root.header()}>
          <div className={styles.root.header.image()}>
            {image && <Image layout="fill" objectFit="cover" src={image.src} />}
          </div>
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
