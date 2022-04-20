import {fromModule, HStack, Stack} from '@alinea/ui'
import {ComponentType, Fragment, PropsWithChildren, ReactNode} from 'react'
import {MdOutlineExpandMore} from 'react-icons/md'
import type {JSONOutput} from 'typedoc'
import css from './Declaration.module.scss'

const styles = fromModule(css)

export enum ReflectionKind {
  Project = 1,
  Module = 2,
  Namespace = 4,
  Enum = 8,
  EnumMember = 16,
  Variable = 32,
  Function = 64,
  Class = 128,
  Interface = 256,
  Constructor = 512,
  Property = 1024,
  Method = 2048,
  CallSignature = 4096,
  IndexSignature = 8192,
  ConstructorSignature = 16384,
  Parameter = 32768,
  TypeLiteral = 65536,
  TypeParameter = 131072,
  Accessor = 262144,
  GetSignature = 524288,
  SetSignature = 1048576,
  ObjectLiteral = 2097152,
  TypeAlias = 4194304,
  Event = 8388608,
  Reference = 16777216
}

const Symbol = styles.type.symbol.toElement('span')
const Tree = styles.type.tree.toElement('span')
const Leaf = styles.type.leaf.toElement('span')
const Label = styles.type.label.toElement('span')
const Param = styles.type.param.toElement('span')
const Indent = styles.type.indent.toElement('div')

type TypeProps = {
  type: JSONOutput.SomeType
  needsParens?: boolean
  inline?: boolean
}

function Type({type, needsParens, inline}: TypeProps) {
  const Wrap = inline ? Fragment : Indent
  switch (type.type) {
    case 'array':
      return (
        <>
          <Leaf>Array</Leaf>
          <Symbol>&lt;</Symbol>
          <Type type={type.elementType} inline={inline} />
          <Symbol>&gt;</Symbol>
        </>
      )
    case 'conditional':
      return (
        <>
          {needsParens && <Symbol>(</Symbol>}
          <Type type={type.checkType} needsParens />
          <Symbol> extends </Symbol>
          <Type type={type.extendsType} inline />
          <Wrap>
            <Symbol> ? </Symbol>
            <Type type={type.trueType} inline={inline} />
          </Wrap>
          <Wrap>
            <Symbol> : </Symbol>
            <Type type={type.falseType} inline={inline} />
          </Wrap>
          {needsParens && <Symbol>)</Symbol>}
        </>
      )
    case 'indexedAccess':
      return (
        <>
          <Type type={type.objectType} inline={inline} />
          <Symbol>[</Symbol>
          <Type type={type.indexType} inline={inline} />
          <Symbol>]</Symbol>
        </>
      )
    case 'inferred':
      return (
        <>
          <Symbol>infer </Symbol> {type.name}
        </>
      )
    case 'intersection':
      return (
        <>
          {needsParens && <Symbol>(</Symbol>}
          <TypeList
            types={type.types as Array<JSONOutput.SomeType>}
            join={<Symbol> &amp; </Symbol>}
            needsParens
            inline={inline}
          />
          {needsParens && <Symbol>)</Symbol>}
        </>
      )
    case 'intrinsic':
      return <Leaf>{type.name}</Leaf>
    case 'literal':
      return <Leaf>{JSON.stringify(type.value)}</Leaf>
    case 'optional':
      return (
        <>
          <Type type={type.elementType} inline={inline} />
          <Symbol>?</Symbol>
        </>
      )
    case 'predicate':
      return (
        <>
          {type.asserts && <Symbol>asserts </Symbol>}
          <Leaf>{type.name}</Leaf>
          {type.targetType && (
            <>
              <Symbol> is </Symbol>
              <Type type={type.targetType} inline={inline} />
            </>
          )}
        </>
      )
    case 'query':
      return (
        <>
          <Symbol>typeof </Symbol>
          <Type type={type.queryType} inline={inline} />
        </>
      )
    case 'reflection':
      if (type.declaration?.children) {
        return (
          <Declaration
            members={[
              {
                kind: ReflectionKind.ObjectLiteral,
                name: '',
                children: type.declaration?.children
              } as any
            ]}
            inline={inline}
          />
        )
      } else {
        return <Tree>&#123;&#125;</Tree>
      }
    case 'reference':
      return (
        <>
          <Leaf>{type.name}</Leaf>
          {type.typeArguments && (
            <>
              <Symbol>&lt;</Symbol>
              <TypeList types={type.typeArguments} inline={inline} />
              <Symbol>&gt;</Symbol>
            </>
          )}
        </>
      )
    case 'rest':
      return (
        <>
          <Symbol>...</Symbol>
          <Type type={type.elementType} inline={inline} />
        </>
      )
    case 'tuple':
      return (
        <>
          <Symbol>[</Symbol>
          <TypeList types={type.elements} />
          <Symbol>]</Symbol>
        </>
      )
    case 'typeOperator':
      return (
        <>
          <Symbol>{type.operator} </Symbol>
          <Type type={type.target} inline={inline} />
        </>
      )
    case 'union':
      return (
        <>
          {needsParens && <Symbol>(</Symbol>}
          {type.types.map((type, i) => {
            return (
              <Wrap key={i}>
                {(!inline || i > 0) && <Tree> | </Tree>}
                <Type type={type as JSONOutput.SomeType} inline />
              </Wrap>
            )
          })}
          {needsParens && <Symbol>)</Symbol>}
        </>
      )
    case 'unknown':
      return <Leaf>{type.name}</Leaf>
  }
}

type TypeListProps = {
  types?: Array<JSONOutput.SomeType>
  join?: ReactNode
  needsParens?: boolean
  inline?: boolean
}

function TypeList({
  types,
  join = <Symbol>, </Symbol>,
  needsParens,
  inline
}: TypeListProps) {
  if (!types) return null
  return (
    <>
      {types.map((type, i) => (
        <Fragment key={i}>
          {i > 0 && join}
          <Type key={i} type={type} needsParens={needsParens} inline={inline} />
        </Fragment>
      ))}
    </>
  )
}

type TypeParamsProps = {
  params?: Array<JSONOutput.TypeParameterReflection>
}

function TypeParams({params}: TypeParamsProps) {
  if (!params) return null
  return (
    <>
      <Symbol>&lt;</Symbol>
      {params.map((param, i) => {
        return (
          <Fragment key={i}>
            <Leaf>{param.name}</Leaf>
            {param.type && (
              <>
                <Symbol> extends </Symbol>
                <Type type={param.type} inline />
              </>
            )}
            {param.default && (
              <>
                <Symbol> = </Symbol>
                <Type type={param.default} inline />
              </>
            )}
          </Fragment>
        )
      })}
      <Symbol>&gt;</Symbol>
    </>
  )
}

type SignatureProps = {
  inline?: boolean
  signature: JSONOutput.SignatureReflection
}

function Signature({inline, signature}: SignatureProps) {
  const Wrap = inline ? Fragment : Indent
  const typeParams: Array<JSONOutput.TypeParameterReflection> =
    signature.typeParameter as any
  return (
    <>
      {typeParams && <TypeParams params={typeParams} />}
      <Symbol>(</Symbol>
      {signature.parameters?.map((param, i, params) => {
        return (
          <Wrap key={i}>
            <Param>
              {param.name === '__namedParameters' ? 'props' : param.name}
            </Param>
            {param.type && (
              <>
                <Symbol>: </Symbol>
                <Type type={param.type as JSONOutput.SomeType} inline />
              </>
            )}
            {i < params.length - 1 && <Symbol>, </Symbol>}
          </Wrap>
        )
      })}
      <Symbol>)</Symbol>
      {signature.type && (
        <>
          <Symbol>: </Symbol>
          <Type type={signature.type as JSONOutput.SomeType} inline />
        </>
      )}
    </>
  )
}

function MemberWrapper({children}: PropsWithChildren<{}>) {
  return (
    <>
      <input type="checkbox" className={styles.wrapper.checkbox()} />
      <div>{children}</div>
    </>
  )
}

function MemberWrapperLabel({children}: PropsWithChildren<{}>) {
  return (
    <label className={styles.wrapperLabel()}>
      {children}
      <span className={styles.wrapperLabel.icon()}>
        <MdOutlineExpandMore size={20} />
      </span>
    </label>
  )
}

type CommentProps = {
  comment?: JSONOutput.Comment
}

function Comment({comment}: CommentProps) {
  if (!comment) return null
  return (
    <div className={styles.comment()}>
      <HStack>
        /* <Indent>{comment.shortText || comment.text}</Indent>{' '}
        <Stack.Right style={{alignSelf: 'flex-end'}}>*/</Stack.Right>
      </HStack>
    </div>
  )
}

type MemberProps = {
  inline?: boolean
  member: JSONOutput.DeclarationReflection
}

function Member({member, inline}: MemberProps) {
  const Wrap = inline ? Fragment : 'div'
  const Content = inline ? Fragment : MemberWrapper
  const ContentLabel = inline ? Fragment : MemberWrapperLabel
  if (member.name.startsWith('__')) return null
  switch (member.kind) {
    case ReflectionKind.Enum:
      return (
        <ContentLabel>
          <Comment comment={member.comment} />
          enum
          <Indent>
            <Label>{member.name}</Label>
            <Content>
              <Tree> &#123;</Tree>
              <Declaration members={member.children} inline={inline} />
              <Tree>&#125;</Tree>
            </Content>
          </Indent>
        </ContentLabel>
      )
    case ReflectionKind.EnumMember:
      return (
        <>
          <Comment comment={member.comment} />
          <Param>{member.name}</Param>
        </>
      )
    case ReflectionKind.Constructor:
    case ReflectionKind.Method:
      return (
        <>
          {member.signatures?.map((signature, i) => (
            <Wrap key={i}>
              <Comment comment={signature.comment} />
              <Param>{member.name}</Param>
              <Signature signature={signature} />
            </Wrap>
          ))}
        </>
      )
    case ReflectionKind.Function:
      return (
        <>
          {member.signatures?.map((signature, i) => (
            <Wrap key={i}>
              <Comment comment={signature.comment} />
              function
              <Indent>
                <Label>{member.name}</Label>
                <Signature signature={signature} />
              </Indent>
            </Wrap>
          ))}
        </>
      )
    case ReflectionKind.Accessor:
    case ReflectionKind.Property:
    case ReflectionKind.Event:
      return (
        <>
          <Comment comment={member.comment} />
          <Param>{member.name}</Param>
          {member.type && (
            <>
              <Symbol>: </Symbol>
              <Type type={member.type as JSONOutput.SomeType} inline={inline} />
            </>
          )}
        </>
      )
    case ReflectionKind.TypeLiteral:
    case ReflectionKind.ObjectLiteral:
      return (
        <ContentLabel>
          <Comment comment={member.comment} />
          <Tree>&#123;</Tree>
          <Content>
            <Declaration
              members={member.children}
              join={inline ? <Symbol>, </Symbol> : undefined}
              inline={inline}
            />
          </Content>
          <Tree>&#125;</Tree>
        </ContentLabel>
      )
    case ReflectionKind.Class:
      return (
        <ContentLabel>
          <Comment comment={member.comment} />
          class
          <Indent>
            <Label>{member.name}</Label>
            {member.extendedTypes && (
              <>
                {' '}
                extends <TypeList types={member.extendedTypes} inline />
              </>
            )}
            {member.implementedTypes && (
              <>
                {' '}
                implements <TypeList types={member.implementedTypes} inline />
              </>
            )}
            <Content>
              <Tree> &#123;</Tree>
              <Declaration members={member.children} inline={inline} />
              <Tree>&#125;</Tree>
            </Content>
          </Indent>
        </ContentLabel>
      )
    case ReflectionKind.Interface:
      return (
        <ContentLabel>
          <Comment comment={member.comment} />
          interface
          <Indent>
            <Label>{member.name}</Label>
            {member.extendedTypes && (
              <>
                {' '}
                extends <TypeList types={member.extendedTypes} inline />
              </>
            )}
            {member.implementedTypes && (
              <>
                {' '}
                implements <TypeList types={member.implementedTypes} inline />
              </>
            )}
            <Content>
              <Tree> &#123;</Tree>
              <Declaration members={member.children} inline={inline} />
              <Tree>&#125;</Tree>
            </Content>
          </Indent>
        </ContentLabel>
      )
    case ReflectionKind.Namespace:
      return (
        <ContentLabel>
          <Comment comment={member.comment} />
          namespace
          <Indent>
            <Label>{member.name}</Label>
            <Content>
              <Tree> &#123;</Tree>
              <Declaration members={member.children} inline={inline} />
              <Tree>&#125;</Tree>
            </Content>
          </Indent>
        </ContentLabel>
      )
    case ReflectionKind.TypeAlias:
      return (
        <ContentLabel>
          <Comment comment={member.comment} />
          type
          <Indent>
            <Label>{member.name}</Label>{' '}
            <Content>
              ={' '}
              <Type type={member.type as JSONOutput.SomeType} inline={inline} />
            </Content>
          </Indent>
        </ContentLabel>
      )
    case ReflectionKind.Variable:
      return (
        <>
          <Comment comment={member.comment} />
          const
          <Indent>
            <Label>{member.name}</Label>:{' '}
            <Type type={member.type as JSONOutput.SomeType} inline={inline} />
          </Indent>
        </>
      )
    default:
      return <>{member.name}</>
  }
}

export type DeclarationProps = {
  members?: Array<JSONOutput.DeclarationReflection>
  join?: ReactNode
  inline?: boolean
  wrap?: ComponentType
}

export function Declaration({members, join, wrap, inline}: DeclarationProps) {
  if (!members) return null
  const Root = inline ? Fragment : Indent
  const Wrap = wrap || (inline ? Fragment : 'div')
  return (
    <Root>
      {members.filter(Boolean).map((child, i) => (
        <Fragment key={i}>
          {i > 0 && join}
          <Wrap>
            <Member member={child} inline={inline} />
          </Wrap>
        </Fragment>
      ))}
    </Root>
  )
}
