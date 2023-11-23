import {slugify} from 'alinea/core/util/Slugs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('slugs', () => {
  assert.is(slugify('a b c'), 'a-b-c')
  assert.is(slugify('A-B  c'), 'a-b-c')
})

test('emojis', () => {
  // sequences
  assert.is(
    slugify('👮🏿 👍🏽 🕵🏻 💃👩🏿‍🤝‍👩🏼 🐕‍🦺 👨‍👩‍👧‍👦 🏳️‍🌈 👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏴󠁧󠁢󠁷󠁬󠁳*️⃣ 5️⃣ #️⃣ 9️⃣'),
    '👮🏿-👍🏽-🕵🏻-💃👩🏿‍🤝‍👩🏼-🐕‍🦺-👨‍👩‍👧‍👦-🏳️‍🌈-👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿-🏴󠁧󠁢󠁳󠁣󠁴󠁿-🏴󠁧󠁢󠁷󠁬󠁳*️⃣-5️⃣-#️⃣-9️⃣'
  )
})

test('punctuation', () => {
  assert.is(slugify('a«b»c'), 'a-b-c')
  assert.is(slugify('a“b”c 😊'), 'a-b-c-😊')
})

test('numbers', () => {
  assert.is(slugify('a1b2c'), 'a1b2c')
})

test('whitespace', () => {
  assert.is(slugify('a b c'), 'a-b-c')
  assert.is(slugify('a\tb\tc'), 'a-b-c')
  assert.is(slugify('a\nb\nc'), 'a-b-c')
  assert.is(slugify('a\rb\rc'), 'a-b-c')
})

test('symbols', () => {
  assert.is(
    slugify('a!b@c#$d%e^f&g*h(i)j-k_l+m=n_o[p]q{r}'),
    'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r'
  )
})

test.run()
