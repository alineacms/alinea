import {fromModule, HStack, px} from '@alinea/ui'
import {ComponentType, Fragment, PropsWithChildren, ReactNode} from 'react'
import {MdKeyboardArrowRight} from 'react-icons/md'
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
const Keyword = styles.type.keyword.toElement('span')

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
          <Symbol>infer </Symbol> <Leaf>{type.name}</Leaf>
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
            inner
          />
        )
      } else if (type.declaration) {
        return (
          <Declaration members={[type.declaration]} inline={inline} inner />
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
  wrap?: boolean
  params?: Array<JSONOutput.TypeParameterReflection>
}

function TypeParams({wrap = true, params}: TypeParamsProps) {
  if (!params) return null
  return (
    <>
      {wrap && <Symbol>&lt;</Symbol>}
      {params.map((param, i) => {
        return (
          <Fragment key={i}>
            {i > 0 && <Symbol>, </Symbol>}
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
      {wrap && <Symbol>&gt;</Symbol>}
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
      <HStack>
        <span className={styles.wrapperLabel.icon()}>
          <MdKeyboardArrowRight size={16} />
        </span>
        <div style={{minWidth: 0}}>{children}</div>
      </HStack>
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
      <HStack gap={12}>
        <span>/**</span>{' '}
        <div>
          {comment.shortText || comment.text}{' '}
          <span style={{display: 'inline-block', paddingLeft: px(4)}}>*/</span>
        </div>
      </HStack>
    </div>
  )
}

type MemberProps = {
  inline?: boolean
  inner?: boolean
  member: JSONOutput.DeclarationReflection
}

function Member({member, inline, inner}: MemberProps) {
  const Wrap = inline ? Fragment : 'div'
  const Content = inline || inner ? Fragment : MemberWrapper
  const ContentLabel = inline || inner ? Fragment : MemberWrapperLabel
  switch (member.kind) {
    case ReflectionKind.Enum:
      return (
        <>
          <Comment comment={member.comment} />
          <ContentLabel>
            <Keyword>export enum </Keyword>
            <Label>{member.name}</Label>
            <Content>
              <Tree> &#123;</Tree>
              <Declaration members={member.children} inline={inline} inner />
              <Tree>&#125;</Tree>
            </Content>
          </ContentLabel>
        </>
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
              <Keyword>export function </Keyword>
              <Label>{member.name}</Label>
              <Signature signature={signature} />
            </Wrap>
          ))}
        </>
      )
    case ReflectionKind.Accessor:
      if (member.name.startsWith('__')) return null
      const [signature] = member.getSignature || []
      return (
        <>
          {signature && <Comment comment={signature.comment} />}
          <Keyword>get </Keyword>
          <Param>{member.name}</Param>
          {signature && (
            <>
              <Signature signature={signature} />
            </>
          )}
        </>
      )
    case ReflectionKind.Property:
    case ReflectionKind.Event:
      if (member.name.startsWith('__')) return null
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
        <>
          <Comment comment={member.comment} />
          <ContentLabel>
            <Tree>&#123;</Tree>
            <Content>
              {member.indexSignature ? (
                <Indent>
                  <Comment comment={member.indexSignature.comment} />
                  <Symbol>[</Symbol>
                  <TypeParams
                    wrap={false}
                    params={member.indexSignature.parameters as any}
                  />
                  <Symbol>]: </Symbol>
                  {member.indexSignature.type && (
                    <Type type={member.indexSignature.type} inline={inline} />
                  )}
                </Indent>
              ) : (
                <Declaration
                  members={member.children}
                  join={inline ? <Symbol>, </Symbol> : undefined}
                  inline={inline}
                  inner
                />
              )}
            </Content>
            <Tree>&#125;</Tree>
          </ContentLabel>
        </>
      )
    case ReflectionKind.Class:
      return (
        <>
          <Comment comment={member.comment} />
          <ContentLabel>
            <Keyword>export class </Keyword>
            <Label>{member.name}</Label>
            {member.typeParameter && (
              <TypeParams params={member.typeParameter} />
            )}
            {member.extendedTypes && (
              <>
                <Keyword> extends </Keyword>
                <TypeList types={member.extendedTypes} inline />
              </>
            )}
            {member.implementedTypes && (
              <>
                <Keyword> implements </Keyword>
                <TypeList types={member.implementedTypes} inline />
              </>
            )}
            <Content>
              <Tree> &#123;</Tree>
              <Declaration members={member.children} inline={inline} inner />
              <Tree>&#125;</Tree>
            </Content>
          </ContentLabel>
        </>
      )
    case ReflectionKind.Interface:
      return (
        <>
          <Comment comment={member.comment} />
          <ContentLabel>
            <Keyword>export interface </Keyword>
            {member.typeParameter && (
              <TypeParams params={member.typeParameter} />
            )}
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
              <Declaration members={member.children} inline={inline} inner />
              <Tree>&#125;</Tree>
            </Content>
          </ContentLabel>
        </>
      )
    case ReflectionKind.Namespace:
      return (
        <>
          <Comment comment={member.comment} />
          <Keyword>export namespace </Keyword>
          <Label>{member.name}</Label>
          <Tree> &#123;</Tree>
          <Declaration
            members={member.children}
            inline={inline}
            inner={inner}
          />
          <Tree>&#125;</Tree>
        </>
      )
    case ReflectionKind.TypeAlias:
      return (
        <>
          <Comment comment={member.comment} />
          <ContentLabel>
            <Keyword>export type </Keyword>
            <Label>{member.name}</Label>
            {member.typeParameter && (
              <TypeParams params={member.typeParameter} />
            )}
            <Content>
              {' '}
              ={' '}
              <Type type={member.type as JSONOutput.SomeType} inline={inline} />
            </Content>
          </ContentLabel>
        </>
      )
    case ReflectionKind.Variable:
      return (
        <>
          <Comment comment={member.comment} />
          <Keyword>export const </Keyword>
          <Label>{member.name}</Label>:{' '}
          <Type type={member.type as JSONOutput.SomeType} inline={inline} />
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
  inner?: boolean
  wrap?: ComponentType
}

export function Declaration({
  members,
  join,
  inner,
  wrap,
  inline
}: DeclarationProps) {
  if (!members) return null
  const Root = wrap || inline ? Fragment : Indent
  const Wrap = wrap || (inline ? Fragment : 'div')
  return (
    <Root>
      {members.filter(Boolean).map((child, i) => (
        <Fragment key={i}>
          {i > 0 && join}
          <Wrap>
            <Member member={child} inline={inline} inner={inner} />
          </Wrap>
        </Fragment>
      ))}
    </Root>
  )
}
