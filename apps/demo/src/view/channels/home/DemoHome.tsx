import css from './DemoHome.module.scss'

import {fromModule, RichText, TextLabel} from '@alinea/ui'
import {DemoButton} from '../../layout/DemoButton'
import {DemoContainer} from '../../layout/DemoContainer'
import {DemoImage} from '../../layout/DemoImage'
import {DemoLayout} from '../../layout/DemoLayout'
import {DemoTitle} from '../../layout/DemoTitle'
import {DemoHomeSchema} from './DemoHome.schema'

const styles = fromModule(css)

type HeroProps = DemoHomeSchema['hero']

export function DemoHome(props: DemoHomeSchema) {
  const {title, hero} = props

  return (
    <DemoLayout>
      <div className={styles.root()}>
        <Hero {...hero} title={hero?.title || title} />
      </div>
    </DemoLayout>
  )
}

function Hero({image, title, text, button}: HeroProps) {
  return (
    <div className={styles.hero({image: image?.src})}>
      {image?.src && (
        <>
          <DemoImage
            src={image.src}
            width={image.width}
            height={image.height}
            layout="fill"
            className={styles.hero.image()}
          />
          <span className={styles.hero.overlay()} />
        </>
      )}
      <DemoContainer>
        <div className={styles.hero.content()}>
          <DemoTitle.H1 mod="inherit">{title}</DemoTitle.H1>
          {text && (
            <div className={styles.hero.content.text()}>
              <RichText doc={text} />
            </div>
          )}
          {button?.url && (
            <DemoButton
              to={button.url}
              className={styles.hero.content.button()}
            >
              <TextLabel label={button.title} />
            </DemoButton>
          )}
        </div>
      </DemoContainer>
    </div>
  )
}
