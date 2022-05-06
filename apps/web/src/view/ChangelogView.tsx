import {fromModule} from '@alinea/ui'
import {useEffect, useState} from 'react'
import css from './ChangelogView.module.scss'

const styles = fromModule(css)

export type ChangelogViewProps = {content: string}

export default function ChangelogView(props: ChangelogViewProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const [stickyHeading, setStickyHeading] = useState<number | undefined>(
    undefined
  )

  useEffect(() => {
    const elements = document.getElementsByTagName('h2')
    const onScroll = e => {
      setScrollTop(e.currentTarget.scrollTop)
      const topHeading = Array.from(elements)
        .map((el, index) => ({id: index, top: el.getBoundingClientRect().top}))
        .filter(el => el.top >= 0 && el.top < 180)
      if (topHeading.length === 0) return
      setStickyHeading(topHeading[topHeading.length - 1].id)
    }
    window.addEventListener('scroll', onScroll)

    return () => window.removeEventListener('scroll', onScroll)
  }, [scrollTop])

  useEffect(() => {
    const elements = document.getElementsByTagName('h2')
    Array.from(elements).map(el => el.classList.remove('is-sticky'))
    stickyHeading !== undefined &&
      elements[stickyHeading].classList.add('is-sticky')
  }, [stickyHeading])

  return (
    <div
      className={styles.root()}
      dangerouslySetInnerHTML={{__html: props.content}}
    />
  )
}
