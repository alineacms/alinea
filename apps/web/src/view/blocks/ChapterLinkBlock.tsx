import {Page} from '@alinea/content'
import {fromModule, HStack, Stack} from 'alinea/ui'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import Link from 'next/link'
import css from './ChapterLinkBlock.module.scss'

const styles = fromModule(css)

export function ChapterLinkBlock({link}: Page.ChapterLinkBlock) {
  if (!link || !link.url) return null
  return (
    <Link href={link.url}>
      <a
        className={styles.root()}
        target={link.type === 'url' ? '_blank' : undefined}
        rel={link.type === 'url' ? 'nofollow noopener' : undefined}
      >
        <HStack center gap={8}>
          <span className={styles.root.title()}>
            {(link.description || link.title) as string}
          </span>
          <Stack.Right>
            <IcRoundArrowForward />
          </Stack.Right>
        </HStack>
      </a>
    </Link>
  )
}
