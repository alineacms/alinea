import {Loader} from 'alinea/ui'
import {PropsWithChildren, ReactNode, Suspense, useEffect, useRef} from 'react'

function OnLoaded({onLoad, children}: PropsWithChildren<{onLoad: () => void}>) {
  useEffect(() => {
    onLoad()
  })
  return <>{children}</>
}

export function KeepInView({children}: PropsWithChildren<{}>) {
  const inView = useRef<ReactNode | null>(null)
  return (
    <Suspense fallback={inView.current ? inView.current : <Loader absolute />}>
      <OnLoaded onLoad={() => (inView.current = children)}>{children}</OnLoaded>
    </Suspense>
  )
}
