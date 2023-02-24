import {fromModule, HStack} from 'alinea/ui'
import {useEffect, useRef} from 'react'
import css from './ChangelogView.module.scss'
import {InformationBar} from './layout/InformationBar'
import {Layout} from './layout/Layout'
import {LayoutProps} from './layout/Layout.server'
import {NavSidebar} from './layout/NavSidebar'

const styles = fromModule(css)

export interface ChangelogProps {
  layout: LayoutProps
  content: string
}

export function ChangelogView({layout, content}: ChangelogProps) {
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
    <Layout {...layout}>
      <Layout.Container>
        <HStack>
          <NavSidebar>
            <InformationBar />
          </NavSidebar>
          <Layout.Scrollable>
            <div
              ref={divRef}
              className={styles.root()}
              dangerouslySetInnerHTML={{__html: content}}
            />
          </Layout.Scrollable>
        </HStack>
      </Layout.Container>
    </Layout>
  )
}
