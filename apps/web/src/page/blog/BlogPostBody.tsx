import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import {RichText} from 'alinea/ui/RichText'
import Image from 'next/image'
import Link from 'next/link'
import reactStringReplace from 'react-string-replace'
import {CodeVariantsView} from '@/page/blocks/CodeVariantsView'
import {ExampleBlockView} from '@/page/blocks/ExampleBlockView'
import type {ChapterLinkBlock} from '@/schema/blocks/ChapterLinkBlock'
import type {ImageBlock} from '@/schema/blocks/ImageBlock'
import type {textField} from '@/schema/fields/TextField'
import {BlogCodeBlock} from './BlogCodeBlock'
import {BlogNotice} from './BlogNotice'
import css from './BlogPostBody.module.scss'

const styles = styler(css)

interface BlogTextProps {
  children: string | undefined
}

// Text between backticks renders as inline code
function BlogText({children}: BlogTextProps) {
  if (!children) return null
  return reactStringReplace(children, /`(.+?)`/g, (match, i) => (
    <code className={styles.root.code()} key={i}>
      {match}
    </code>
  ))
}

function BlogImage({image}: Infer<typeof ImageBlock>) {
  if (!image?.src) return null
  const blurUrl = imageBlurUrl(image)
  return (
    <figure className={styles.root.figure()}>
      <Image
        className={styles.root.figure.image()}
        alt={image.alt || image.title || ''}
        src={image.src}
        width={image.width}
        height={image.height}
        style={{maxWidth: image.width * 0.5}}
        sizes="(max-width: 720px) 100vw, 680px"
        placeholder={blurUrl ? 'blur' : undefined}
        blurDataURL={blurUrl}
      />
    </figure>
  )
}

function BlogChapterLink({link}: Infer<typeof ChapterLinkBlock>) {
  if (!link?.href) return null
  const label = link.fields.description || link.title
  return (
    <Link href={link.href} className={styles.root.chapter()}>
      {label} →
    </Link>
  )
}

export interface BlogPostBodyProps {
  body: Infer<ReturnType<typeof textField>>
}

export function BlogPostBody({body}: BlogPostBodyProps) {
  return (
    <div className={styles.root()}>
      <RichText
        doc={body}
        text={BlogText}
        p={<p className={styles.root.paragraph()} />}
        h1={<h2 className={styles.root.h2()} />}
        h2={<h2 className={styles.root.h2()} />}
        h3={<h3 className={styles.root.h3()} />}
        h4={<h4 className={styles.root.h4()} />}
        a={<a className={styles.root.link()} />}
        b={<strong className={styles.root.strong()} />}
        ul={<ul className={styles.root.list()} />}
        ol={<ol className={styles.root.list('ordered')} />}
        li={<li className={styles.root.listItem()} />}
        blockquote={<blockquote className={styles.root.blockquote()} />}
        hr={<hr className={styles.root.rule()} />}
        CodeBlock={BlogCodeBlock}
        CodeVariantsBlock={CodeVariantsView}
        ExampleBlock={ExampleBlockView}
        NoticeBlock={BlogNotice}
        ImageBlock={BlogImage}
        ChapterLinkBlock={BlogChapterLink}
      />
    </div>
  )
}
