// @ts-ignore
import {useRevalidator} from 'react-router-dom'
import {usePreview} from './react'

export function useRemixPreview() {
  const revalidator = useRevalidator()
  return usePreview({
    async refetch() {
      revalidator.revalidate()
    }
  })
}
