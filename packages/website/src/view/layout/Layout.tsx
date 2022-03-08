import {Viewport} from '@alinea/ui'
import {PropsWithChildren} from 'react'
import {Footer} from './Footer'
import {Header} from './Header'
import {LayoutProps} from './Layout.query'

export function Layout({children, header}: PropsWithChildren<LayoutProps>) {
  return (
    <Viewport color="#FB934F">
      <Header {...header} />
      {children}
      <Footer />
    </Viewport>
  )
}
