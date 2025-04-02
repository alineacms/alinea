import {suite} from '@alinea/suite'
import {slugify} from 'alinea/core/util/Slugs'

const test = suite(import.meta)

test('slugs', () => {
  test.is(slugify('a b c'), 'a-b-c')
  test.is(slugify('A-B  c'), 'a-b-c')
})

test('emojis', () => {
  // sequences
  test.is(
    slugify('👮🏿 👍🏽 🕵🏻 💃👩🏿‍🤝‍👩🏼 🐕‍🦺 👨‍👩‍👧‍👦 🏳️‍🌈 👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏴󠁧󠁢󠁷󠁬󠁳*️⃣ 5️⃣ #️⃣ 9️⃣'),
    '👮🏿-👍🏽-🕵🏻-💃👩🏿‍🤝‍👩🏼-🐕‍🦺-👨‍👩‍👧‍👦-🏳️‍🌈-👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿-🏴󠁧󠁢󠁳󠁣󠁴󠁿-🏴󠁧󠁢󠁷󠁬󠁳*️⃣-5️⃣-#️⃣-9️⃣'
  )
})

test('punctuation', () => {
  test.is(slugify('a«b»c'), 'a-b-c')
  test.is(slugify('a“b”c 😊'), 'a-b-c-😊')
})

test('numbers', () => {
  test.is(slugify('a1b2c'), 'a1b2c')
})

test('whitespace', () => {
  test.is(slugify('a b c'), 'a-b-c')
  test.is(slugify('a\tb\tc'), 'a-b-c')
  test.is(slugify('a\nb\nc'), 'a-b-c')
  test.is(slugify('a\rb\rc'), 'a-b-c')
})

test('symbols', () => {
  test.is(
    slugify('a!b@c#$d%e^f&g*h(i)j-k_l+m=n_o[p]q{r}'),
    'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r'
  )
  test.is(slugify("that's"), 'thats')
})
