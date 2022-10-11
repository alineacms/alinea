// @ts-ignore
import {useRevalidator} from 'react-router-dom'
import {usePreview as useReactPreview} from './react'

export function usePreview() {
  const revalidator = useRevalidator()
  return useReactPreview({
    async refetch() {
      revalidator.revalidate()
    }
  })
}
