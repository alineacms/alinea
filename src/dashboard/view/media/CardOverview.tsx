import {useTranslation} from '../../hook/useTranslation.js'

export function CardOverview() {
  const {cardOverview: t} = useTranslation()
  return <div>{t.title}</div>
}
