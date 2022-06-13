import {User} from '@alinea/core'
import {getRandomColor} from '@alinea/core/util/GetRandomColor'
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
        width: '24px',
        height: '24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '13px',
        fontWeight: 'bold'
      }}
    >
      <span>{letter}</span>
    </div>
  )
}
