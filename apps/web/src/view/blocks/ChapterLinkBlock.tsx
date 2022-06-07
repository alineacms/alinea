import {fromModule, HStack, Stack} from '@alinea/ui'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import Link from 'next/link'
import css from './ChapterLinkBlock.module.scss'
import {ChapterLinkBlockSchema} from './ChapterLinkBlock.schema'

const styles = fromModule(css)

export function ChapterLinkBlock({link}: ChapterLinkBlockSchema) {
  if (!link) return null
  return (
    <Link href={link.url}>
      <a className={styles.root()}>
        <HStack center gap={8}>
          <span className={styles.root.title()}>{link.title as string}</span>
          <Stack.Right>
            <IcRoundArrowForward />
          </Stack.Right>
        </HStack>
      </a>
    </Link>
  )
}
