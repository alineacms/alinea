import {TextDoc} from 'alinea/core'
import {LinkData} from 'alinea/input/link'
import {fromModule, HStack} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import Image from 'next/image'
import Link from 'next/link'
import css from './DemoHeader.module.scss'
import {DemoText} from './DemoText'

const styles = fromModule(css)

export interface DemoHeaderProps {
  image?: LinkData.Image
  credit?: TextDoc
  backLink?: string
}

export function DemoHeader({image, backLink, credit}: DemoHeaderProps) {
  const hasImage = image?.src
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
        <div className={styles.root.image()}>
          <Image layout="fill" objectFit="cover" src={image.src} />
        </div>
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
