import css from './DemoHero.module.scss'

import {LinkData} from '@alinea/input.link'
import {fromModule} from '@alinea/ui'
import {Fragment} from 'react'
import {DemoContainer} from '../../layout/DemoContainer'
import {DemoImage} from '../../layout/DemoImage'
import {DemoLink} from '../../layout/DemoLink'
import {DemoTitle} from '../../layout/DemoTitle'

const styles = fromModule(css)

type DemoHeroProps = {
  title: string
  image: LinkData.Image
  parents?: {url: string; title: string}[]
}

export function DemoHero({title, image}: DemoHeroProps) {
  const parents = [
    {url: '/', title: 'Home'},
    {url: '/recipes', title: 'Recipes'}
  ]

  return (
    <div className={styles.root()}>
      {image?.src && (
        <Fragment>
          <DemoImage {...image} layout="fill" className={styles.root.image()} />
          <span className={styles.root.overlay()} />
        </Fragment>
      )}
      <DemoContainer>
        <div className={styles.root.content({image: image?.src})}>
          <DemoTitle.H1 mod={image?.src ? 'inherit' : undefined}>
            {title}
          </DemoTitle.H1>
          <Breadcrumbs parents={parents} title={title} />
        </div>
      </DemoContainer>
    </div>
  )
}

function Breadcrumbs({
  parents,
  title
}: {
  title: string
  parents?: {url: string; title: string}[]
}) {
  if (!parents || parents?.length < 1) return null

  return (
    <div className={styles.breadcrumbs()}>
      {parents.map((page, i) => (
        <Fragment>
          {i > 0 && <span className={styles.breadcrumbs.divider()}>/</span>}
          <DemoLink to={page.url} key={i}>
            {page.title}
          </DemoLink>
        </Fragment>
      ))}
      <span className={styles.breadcrumbs.divider()}>/</span>
      <p className={styles.breadcrumbs.current()}>{title}</p>
    </div>
  )
}
