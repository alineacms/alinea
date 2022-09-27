import {BlogPost} from '../schema'
import PostPreview from './post-preview'

type Props = {
  posts: BlogPost[]
}

const MoreStories = ({posts}: Props) => {
  return (
    <section>
      <h2 className="mb-8 text-5xl md:text-7xl font-bold tracking-tighter leading-tight">
        More Stories
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-16 lg:gap-x-32 gap-y-20 md:gap-y-32 mb-32">
        {posts.map(post => (
          <PostPreview
            key={post.path}
            title={post.title}
            coverImage={post.coverImage?.src}
            date={post.date}
            // Todo: pass picture
            author={post.author as any}
            slug={post.path}
            excerpt={post.excerpt}
          />
        ))}
      </div>
    </section>
  )
}

export default MoreStories
