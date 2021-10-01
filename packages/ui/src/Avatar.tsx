import {User} from '@alinea/core'
import {useContrastColor} from './hook/UseContrastColor'
import {getRandomColor} from './util/GetRandomColor'

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
        fontSize: '13px'
      }}
    >
      <span>{letter}</span>
    </div>
  )
}
