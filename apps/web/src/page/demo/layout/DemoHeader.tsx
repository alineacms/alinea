import styler from '@alinea/styler'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {ImageLink, TextDoc} from 'alinea'
import {HStack, imageBlurUrl} from 'alinea/ui'
import Image from 'next/image'
import Link from 'next/link'
import css from './DemoHeader.module.scss'
import {DemoText} from './DemoText'

const styles = styler(css)

export interface DemoHeaderProps {
  image?: ImageLink
  credit?: TextDoc
  backLink?: string
}

export function DemoHeader({image, backLink, credit}: DemoHeaderProps) {
  const hasImage = image?.src
  const blurUrl = image && imageBlurUrl(image)
  return (
    <header className={styles.root({open: hasImage})}>
      {backLink && (
        <Link href={backLink}>
          <a className={styles.root.back()}>
            <HStack gap={8} center>
              <IcRoundArrowBack />
              <span>Back</span>
            </HStack>
          </a>
        </Link>
      )}

      {hasImage && (
        <Image
          className={styles.root.image()}
          width={image.width}
          height={image.height}
          alt={image.title}
          src={image.src}
          sizes="450px"
          placeholder={blurUrl ? 'blur' : undefined}
          blurDataURL={blurUrl}
        />
      )}

      <div className={styles.root.title()}>
        Milk &<br />
        Cookies
      </div>

      {hasImage && credit && (
        <div className={styles.root.credit()}>
          <DemoText doc={credit} />
        </div>
      )}
    </header>
  )
}
