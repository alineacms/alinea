import {useTranslation} from '../../hook/useTranslation'

export function CardOverview() {
  const {cardOverview: t} = useTranslation()
  return <div>{t.title}</div>
}
