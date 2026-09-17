import type {HTMLAttributes, PropsWithChildren} from 'react'

function Left(props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div {...props} style={{...props.style, marginRight: 'auto'}} />
}

function Center(props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      {...props}
      style={{...props.style, marginRight: 'auto', marginLeft: 'auto'}}
    />
  )
}

function Right(props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div {...props} style={{...props.style, marginLeft: 'auto'}} />
}

export const Stack = {
  Left,
  Center,
  Right
}