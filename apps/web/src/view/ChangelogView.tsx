import {fromModule} from '@alinea/ui'
import {useEffect, useState} from 'react'
import css from './ChangelogView.module.scss'

const styles = fromModule(css)

export type ChangelogViewProps = {content: string}

export default function ChangelogView(props: ChangelogViewProps) {
  const [stickyHeading, setStickyHeading] = useState<number | undefined>(
    undefined
  )

  useEffect(() => {
    const links = document.getElementsByTagName('a')
    Array.from(links)
      .filter(
        el =>
          !el.classList.value.startsWith('Header') &&
          !el.href.startsWith(window.location.origin)
      )
      .map(el => el.setAttribute('target', '_blank'))
  }, [])

  useEffect(() => {
    const headings = document.getElementsByTagName('h2')
    const onScroll = e => {
      const topHeading = Array.from(headings)
        .map((el, index) => ({id: index, top: el.getBoundingClientRect().top}))
        .filter(el => el.top >= 0 && el.top < 180)
      if (topHeading.length === 0) return
      setStickyHeading(topHeading[topHeading.length - 1].id)
    }
    window.addEventListener('scroll', onScroll)

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const headings = document.getElementsByTagName('h2')
    Array.from(headings).map(el => el.classList.remove('is-sticky'))
    stickyHeading !== undefined &&
      headings[stickyHeading].classList.add('is-sticky')
  }, [stickyHeading])

  return (
    <div
      className={styles.root()}
      dangerouslySetInnerHTML={{__html: props.content}}
    />
  )
}
