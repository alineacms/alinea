import {pages} from '../alinea.config'
import {Home} from '../content/schema/Home'

export default async function HomePage() {
  const homePage = await pages.find(Home().first())
  return (
    <>
      <div>
        <h1>{homePage.title}</h1>
        <p>{homePage.headline}</p>
        <p>
          <i>{homePage.byline}</i>
        </p>
      </div>
    </>
  )
}
