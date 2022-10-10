import {Page} from '@alinea/content'
import {GetStaticPropsContext} from 'next'
import ErrorPage from 'next/error'
import Head from 'next/head'
import {useRouter} from 'next/router'
import Container from '../../components/container'
import Header from '../../components/header'
import Layout from '../../components/layout'
import PostBody from '../../components/post-body'
import PostHeader from '../../components/post-header'
import PostTitle from '../../components/post-title'
import {createApi} from '../../lib/api'
import {CMS_NAME} from '../../lib/constants'

type Props = {
  post: Page.BlogPost
  morePosts: Page.BlogPost[]
  preview?: boolean
}

export default function Post({post, morePosts, preview}: Props) {
  const router = useRouter()
  if (!router.isFallback && !post?.path) {
    return <ErrorPage statusCode={404} />
  }
  const title = `${post.title} | Next.js Blog Example with ${CMS_NAME}`
  return (
    <Layout preview={preview}>
      <Container>
        <Header />
        {router.isFallback ? (
          <PostTitle>Loading…</PostTitle>
        ) : (
          <>
            <article className="mb-32">
              <Head>
                <title>{title}</title>
                <meta property="og:image" content={post.ogImage?.src} />
              </Head>
              <PostHeader
                title={post.title}
                coverImage={post.coverImage?.src}
                date={post.date}
                // Todo: pass picture
                author={post.author as any}
              />
              <PostBody content={post.content} />
            </article>
          </>
        )}
      </Container>
    </Layout>
  )
}

type Params = {
  slug: string
}

export async function getStaticProps({
  params,
  previewData
}: GetStaticPropsContext<Params>) {
  const api = createApi(previewData)
  const post = await api.getPostBySlug(params.slug)
  return {
    props: {post}
  }
}

export async function getStaticPaths(context) {
  const api = createApi(context.previewData)
  const slugs = await api.getPostSlugs()
  return {
    paths: slugs.map(slug => {
      return {
        params: {slug}
      }
    }),
    fallback: false
  }
}
