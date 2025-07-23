import {useTranslation} from '../../hook/UseTranslation.js'

export function CardOverview() {
  const {cardOverview: t} = useTranslation()
  return <div>{t.title}</div>
}
