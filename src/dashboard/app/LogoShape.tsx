import styler from '@alinea/styler'
import {getLuminance} from 'color2k'
import {createElement, type ComponentType, type SVGProps} from 'react'
import {AlineaLogo} from './AlineaLogo.js'
import css from './LogoShape.module.css'

const styles = styler(css)

export interface LogoShapeProps extends SVGProps<SVGSVGElement> {
  background: string
  foreground?: string
  icon?: ComponentType
}

export function logoShapeForeground(background: string): string {
  try {
    return getLuminance(background) > 0.5 ? '#11181c' : '#ffffff'
  } catch {
    return '#ffffff'
  }
}

export function LogoShape({
  background,
  foreground = logoShapeForeground(background),
  icon,
  ...props
}: LogoShapeProps) {
  const Icon = icon ?? AlineaLogo
  return (
    <svg
      {...props}
      className={styles.LogoShape(styler.merge(props))}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path
        d="M18 36C25.884 36 29.9427 36 32.8047 33.138C35.6667 30.276 36 25.884 36 18C36 10.116 35.6667 6.05733 32.8047 3.19533C29.9427 0.333333 25.884 0 18 0C10.116 0 6.05733 0.333333 3.19533 3.19533C0.333333 6.05733 0 10.116 0 18C0 25.884 0.333333 29.9427 3.19533 32.8047C6.05733 35.6667 10.116 36 18 36Z"
        fill={background}
      />
      <g color={foreground} transform="translate(8 8)" fontSize="20">
        {createElement(Icon)}
      </g>
    </svg>
  )
}
