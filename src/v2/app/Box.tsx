import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './Box.css'

interface BaseBoxProps extends ComponentPropsWithoutRef<'div'> {
  children?: ReactNode
}

export function Box({children, className, ...props}: BaseBoxProps) {
  return (
    <div {...props} className={clsx('alinea-rac-Box', className)}>
      {children}
    </div>
  )
}

interface BoxRowProps extends BaseBoxProps {
  position?: 'start' | 'middle' | 'end' | 'between'
}

export function BoxRow({
  children,
  className,
  position = 'between',
  ...props
}: BoxRowProps) {
  return (
    <div
      {...props}
      className={clsx('alinea-rac-BoxRow', className)}
      data-position={position}
    >
      {children}
    </div>
  )
}

export function BoxContent({children, className, ...props}: BaseBoxProps) {
  return (
    <div {...props} className={clsx('alinea-rac-BoxContent', className)}>
      {children}
    </div>
  )
}

export function BoxHeader({children, className, ...props}: BaseBoxProps) {
  return (
    <div {...props} className={clsx('alinea-rac-BoxHeader', className)}>
      {children}
    </div>
  )
}