import {Link} from '@/layout/nav/Link'
import {ChapterLinkBlock} from '@/schema/blocks/ChapterLinkBlock'
import {Infer} from 'alinea'
import {fromModule, HStack, Stack} from 'alinea/ui'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import css from './ChapterLinkView.module.scss'

const styles = fromModule(css)

export function ChapterLinkView({link}: Infer<typeof ChapterLinkBlock>) {
  if (!link || !link.url) return null
  return (
    <Link
      href={link.url}
      className={styles.root()}
      target={link._type === 'url' ? '_blank' : undefined}
      rel={link._type === 'url' ? 'nofollow noopener' : undefined}
    >
      <HStack center gap={8}>
        <span className={styles.root.title()}>
          {(link.description || link.title) as string}
        </span>
        <Stack.Right>
          <IcRoundArrowForward style={{display: 'block'}} />
        </Stack.Right>
      </HStack>
    </Link>
  )
}
