import {Link} from '@/layout/nav/Link'
import {ChapterLinkBlock} from '@/schema/blocks/ChapterLinkBlock'
import {Infer} from 'alinea'
import {fromModule, HStack, Stack} from 'alinea/ui'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import css from './ChapterLinkView.module.scss'

const styles = fromModule(css)

export function ChapterLinkView({link}: Infer<typeof ChapterLinkBlock>) {
  if (!link || !link.href) return null
  return (
    <Link href={link.href} className={styles.root()}>
      <HStack center gap={8}>
        <span className={styles.root.title()}>
          {(link.fields.description || link.title) as string}
        </span>
        <Stack.Right>
          <IcRoundArrowForward style={{display: 'block'}} />
        </Stack.Right>
      </HStack>
    </Link>
  )
}
