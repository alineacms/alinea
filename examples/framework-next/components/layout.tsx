import Alert from './alert.js'
import Footer from './footer.js'
import Meta from './meta.js'

type Props = {
  preview?: boolean
  children: React.ReactNode
}

const Layout = ({preview, children}: Props) => {
  return (
    <>
      <Meta />
      <div className="min-h-screen">
        <Alert preview={preview} />
        <main>{children}</main>
      </div>
      <Footer />
    </>
  )
}

export default Layout
