import {HStack, Typo} from '@alinea/ui'
import {
  MdChangeHistory,
  MdClass,
  MdFormatQuote,
  MdFormatShapes,
  MdFunctions,
  MdList
} from 'react-icons/md'
import {Member, MemberType, TypesBlockProps} from './TypesBlock.query'

function TypeIcon(type: MemberType) {
  switch (type) {
    case MemberType.Class:
      return <MdClass />
    case MemberType.Constant:
      return <MdFormatQuote />
    case MemberType.Enum:
      return <MdList />
    case MemberType.Function:
      return <MdFunctions />
    case MemberType.Interface:
      return <MdFormatShapes />
    case MemberType.Type:
      return <MdChangeHistory />
  }
}

function TypeMember<T>(member: Member<T>) {
  return (
    <div>
      <Typo.H3>
        <HStack center gap={8}>
          <TypeIcon type={member.type} />
          {member.name}
        </HStack>
      </Typo.H3>
    </div>
  )
}

export function TypesBlock({exports, members}: TypesBlockProps) {
  return (
    <div>
      {members.map(member => (
        <TypeMember {...member} />
      ))}
    </div>
  )
}
