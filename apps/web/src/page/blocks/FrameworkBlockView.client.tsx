'use client'

import {getFramework} from '@/layout/nav/Frameworks'
import {useParams} from 'next/navigation'

export interface RenderSelectedFrameworkProps {
  options: Array<[string, React.ReactNode]>
}

export function RenderSelectedFramework({
  options
}: RenderSelectedFrameworkProps) {
  const params = useParams()
  const framework = getFramework(params.framework as string)
  const selected = options.find(([name]) => name === framework.name)
  if (!selected) return null
  return selected[1]
}
