import type {ComponentType, SVGProps} from 'react'
import {
  StrokeAccessibility,
  StrokeCheck,
  StrokeCloud,
  StrokeCode,
  StrokeGitBranch,
  StrokeGlobe,
  StrokeHeart,
  StrokeHistory,
  StrokeHook,
  StrokeLink,
  StrokeLock,
  StrokeMail,
  StrokeFile,
  StrokeSearch,
  StrokeShieldCheck,
  StrokeSparkle,
  StrokeUsers
} from '@/icons'
import type {IconName} from '@/schema/sections/options'

const icons: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  StrokeAccessibility,
  StrokeShieldCheck,
  StrokeCode,
  StrokeGlobe,
  StrokeLink,
  StrokeHook,
  StrokeGitBranch,
  StrokeSearch,
  StrokeCloud,
  StrokeSparkle,
  StrokeHeart,
  StrokeCheck,
  StrokeHistory,
  StrokeUsers,
  StrokeLock,
  StrokeFile,
  StrokeMail
}

export interface SectionIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'name'
> {
  name: string | null | undefined
}

export function SectionIcon({name, ...props}: SectionIconProps) {
  const Icon = name && name in icons ? icons[name as IconName] : undefined
  if (!Icon) return null
  return <Icon {...props} />
}
