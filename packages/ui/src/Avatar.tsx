import {User} from '@alinea/core'
import {getRandomColor} from '@alinea/core/util/GetRandomColor'
import {px} from '@alinea/ui'
import {useContrastColor} from './hook/UseContrastColor'

type AvatarProps = {user: User}

export function Avatar({user}: AvatarProps) {
  const letter = user.sub.charAt(0).toUpperCase()
  const background = getRandomColor(user.sub)
  const color = useContrastColor(background)
  return (
    <div
      style={{
        borderRadius: '100%',
        background: background,
        color: color,
        width: px(24),
        height: px(24),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: px(13),
        fontWeight: 'bold'
      }}
    >
      <span>{letter}</span>
    </div>
  )
}
