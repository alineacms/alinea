import {outcome} from 'alinea/core/Outcome'
import {sign, verify} from 'alinea/core/util/JWT'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const example0 = {
  token:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTY1NTM4NjU0OSwiZXhwIjoxNjU1MzkwMTQ5fQ.XzrLdHgDhx_G1OEl4kc-OdBom7426dTxrMa-nFgIpioe_vavB442wr1RzKjLfpzxi-klLX5vG7UIvt42SjJRb2vS2FUJlChj4FHOOvHveYL6L6Zlwgw-Gpt76i_-IDGcfp52ajZPl_fZDekcXwMFcpJsQzTv_XIynvIUmpFiRSftzike0UdX6FRNU-uEbvu-ekzG8NfXC9T6f8SQTt9JrtHHwOaE9Sbnn6mF1BBLI1HToBLpDen3ZWWIc1IQpLr74q9MKDpclEdgwSacRYMKpwhDgN7KGRGHsCJJBkgw9E834aBAuM2TGGZcO0Tv4z28KwFrKOp9ND-IbyAWcTkigw',
  publicKey: {
    kty: 'RSA',
    n: '6S7asUuzq5Q_3U9rbs-PkDVIdjgmtgWreG5qWPsC9xXZKiMV1AiV9LXyqQsAYpCqEDM3XbfmZqGb48yLhb_XqZaKgSYaC_h2DjM7lgrIQAp9902Rr8fUmLN2ivr5tnLxUUOnMOc2SQtr9dgzTONYW5Zu3PwyvAWk5D6ueIUhLtYzpcB-etoNdL3Ir2746KIy_VUsDwAM7dhrqSK8U2xFCGlau4ikOTtvzDownAMHMrfE7q1B6WZQDAQlBmxRQsyKln5DIsKv6xauNsHRgBAKctUxZG8M4QJIx3S6Aughd3RZC4Ca5Ae9fd8L8mlNYBCrQhOZ7dS0f4at4arlLcajtw',
    e: 'AQAB',
    alg: 'RS512',
    use: 'sig'
  },
  alg: 'RS512' as const,
  payload: {
    sub: '1234567890',
    name: 'John Doe',
    admin: true,
    iat: 1655386549,
    exp: 1655390149
  },
  validAt: 1655386548
}

const example1 = {
  token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o',
  alg: 'HS256' as const,
  payload: {sub: '1234567890', name: 'John Doe', iat: 1516239022},
  header: {alg: 'HS256', typ: 'JWT'},
  secret: 'secret'
}

const example2 = {
  token:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE2NTUzODQ4NDIsImV4cCI6MTY4NjkyMDg0MiwiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoianJvY2tldEBleGFtcGxlLmNvbSIsIkdpdmVuTmFtZSI6IkpvaG5ueSIsIlN1cm5hbWUiOiJSb2NrZXQiLCJFbWFpbCI6Impyb2NrZXRAZXhhbXBsZS5jb20iLCJSb2xlIjpbIk1hbmFnZXIiLCJQcm9qZWN0IEFkbWluaXN0cmF0b3IiXX0.hOGlmibLnbZj530ARio97HMdN7maWSW6E5zFZ28XCLjar6X8b5AGRS3xJe23jTePYdMbDiGVxPZdG_Y-4RzPoA',
  payload: {
    iss: 'Online JWT Builder',
    iat: 1655384842,
    exp: 1686920842,
    aud: 'www.example.com',
    sub: 'jrocket@example.com',
    GivenName: 'Johnny',
    Surname: 'Rocket',
    Email: 'jrocket@example.com',
    Role: ['Manager', 'Project Administrator']
  },
  header: {typ: 'JWT', alg: 'HS512'},
  validAt: 1686920841,
  notValidAt: 1686920842,
  alg: 'HS512' as const,
  secret: 'qwertyuiopasdfghjklzxcvbnm123456'
}

test('sign', async () => {
  assert.is(
    await sign(example1.payload, example1.secret, {
      algorithm: example1.alg,
      header: example1.header
    }),
    example1.token
  )

  assert.is(
    await sign(example2.payload, example2.secret, {algorithm: example2.alg}),
    example2.token
  )
})

test('example 0', async () => {
  assert.equal(
    await verify(example0.token, example0.publicKey, {
      algorithms: [example0.alg],
      clockTimestamp: example0.validAt
    }),
    example0.payload
  )
})

test('example 1', async () => {
  assert.equal(await verify(example1.token, example1.secret), example1.payload)
})

test('example 2', async () => {
  assert.equal(
    await verify(example2.token, example2.secret, {
      algorithms: [example2.alg],
      clockTimestamp: example2.validAt
    }),
    example2.payload
  )
  const [, err] = await outcome(
    verify(example2.token, example2.secret, {
      clockTimestamp: example2.notValidAt
    })
  )
  assert.equal(err, new Error('Token expired'))
})

test.run()
