import {fromModule} from '@alinea/ui'
import {useEffect, useRef} from 'react'
import css from './ChangelogView.module.scss'

const styles = fromModule(css)

export type ChangelogViewProps = {content: string}

export default function ChangelogView(props: ChangelogViewProps) {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (divRef.current) {
      const links = divRef.current.querySelectorAll('a')
      Array.from(links)
        .filter(el => !el.href.startsWith(window.location.origin))
        .map(el => el.setAttribute('target', '_blank'))
    }
  }, [divRef])

  return (
    <div
      ref={divRef}
      className={styles.root()}
      dangerouslySetInnerHTML={{__html: props.content}}
    />
  )
}
