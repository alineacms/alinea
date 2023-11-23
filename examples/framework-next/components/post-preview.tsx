import {TextDoc} from 'alinea'
import {RichText} from 'alinea/ui'
import Link from 'next/link'
import Avatar from './avatar.js'
import CoverImage from './cover-image.js'
import DateFormatter from './date-formatter.js'

type Props = {
  title: string
  coverImage: string
  date: string
  excerpt: TextDoc
  author: Author
  slug: string
}

const PostPreview = ({
  title,
  coverImage,
  date,
  excerpt,
  author,
  slug
}: Props) => {
  return (
    <div>
      <div className="mb-5">
        <CoverImage slug={slug} title={title} src={coverImage} />
      </div>
      <h3 className="text-3xl mb-3 leading-snug">
        <Link as={`/posts/${slug}`} href="/posts/[slug]">
          <a className="hover:underline">{title}</a>
        </Link>
      </h3>
      <div className="text-lg mb-4">
        <DateFormatter dateString={date} />
      </div>
      <RichText
        doc={excerpt}
        p={<p className="text-lg leading-relaxed mb-4" />}
      />
      <Avatar name={author.title} picture={author.picture} />
    </div>
  )
}

export default PostPreview
