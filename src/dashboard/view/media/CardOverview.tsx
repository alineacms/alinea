import {useTranslation} from '../../hook/useTranslation'

export const copy = {
  title: 'card'
}

export function CardOverview() {
  const t = useTranslation(copy)
  return <div>{t.title}</div>
}
