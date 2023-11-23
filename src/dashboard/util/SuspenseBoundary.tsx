import {PropsWithChildren, Suspense, SuspenseProps, useEffect} from 'react'

interface LogMsgProps {
  name: string
}

function LogMsg({name, children}: PropsWithChildren<LogMsgProps>) {
  useEffect(() => {
    console.log(`SuspenseBoundary ${name} fallback triggered`)
  }, [])
  return children
}

export function SuspenseBoundary(props: SuspenseProps & {name: string}) {
  return (
    <Suspense
      {...props}
      fallback={<LogMsg name={props.name}>{props.fallback ?? null}</LogMsg>}
    />
  )
}
