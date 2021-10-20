import {Viewport} from '@alinea/ui'
import {PropsWithChildren} from 'react'
import {Footer} from './Footer'
import {Header} from './Header'

export function Layout({children}: PropsWithChildren<{}>) {
  return (
    <Viewport color="#FB934F">
      <Header />
      {children}
      <Footer />
    </Viewport>
  )
}
