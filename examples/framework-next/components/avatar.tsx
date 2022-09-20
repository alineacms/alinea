import {LinkData} from '@alinea/input.link'

type Props = {
  name: string
  picture: LinkData.Image
}

const Avatar = ({name, picture}: Props) => {
  return (
    <div className="flex items-center">
      {picture?.src && (
        <img
          src={picture.src}
          className="w-12 h-12 rounded-full mr-4"
          alt={name}
        />
      )}
      <div className="text-xl font-bold">{name}</div>
    </div>
  )
}

export default Avatar
