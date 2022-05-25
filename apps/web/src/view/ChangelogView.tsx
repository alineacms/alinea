import {fromModule} from '@alinea/ui'
import {useEffect, useRef, useState} from 'react'
import css from './ChangelogView.module.scss'

const styles = fromModule(css)

export type ChangelogViewProps = {content: string}

export default function ChangelogView(props: ChangelogViewProps) {
  const [stickyHeading, setStickyHeading] = useState<number | undefined>(
    undefined
  )
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (divRef.current) {
      const links = divRef.current.querySelectorAll('a')
      Array.from(links)
        .filter(el => !el.href.startsWith(window.location.origin))
        .map(el => el.setAttribute('target', '_blank'))
    }
  }, [divRef])

  useEffect(() => {
    if (divRef.current) {
      const headings = divRef.current.querySelectorAll('h2')
      const onScroll = () => {
        const topHeading = Array.from(headings)
          .map((el, index) => ({
            id: index,
            top: el.getBoundingClientRect().top
          }))
          .filter(el => el.top >= 0 && el.top < 180)
        if (topHeading.length === 0) return
        setStickyHeading(topHeading[topHeading.length - 1].id)
      }
      window.addEventListener('scroll', onScroll)

      return () => window.removeEventListener('scroll', onScroll)
    }
  }, [divRef])

  useEffect(() => {
    if (divRef.current) {
      const headings = divRef.current.querySelectorAll('h2')
      Array.from(headings).map(el => el.classList.remove('is-sticky'))
      stickyHeading !== undefined &&
        headings[stickyHeading].classList.add('is-sticky')
    }
  }, [divRef, stickyHeading])

  return (
    <div
      ref={divRef}
      className={styles.root()}
      dangerouslySetInnerHTML={{__html: props.content}}
    />
  )
}
