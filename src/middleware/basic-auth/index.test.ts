import { createHash } from 'crypto'
import { Hono } from '../../hono'
import { basicAuth } from '.'

describe('Basic Auth by Middleware', () => {
  let handlerExecuted: boolean

  beforeEach(() => {
    handlerExecuted = false
  })

  const app = new Hono()

  const username = 'hono-user-a'
  const password = 'hono-password-a'
  const unicodePassword = '炎'

  const usernameB = 'hono-user-b'
  const passwordB = 'hono-password-b'

  const usernameC = 'hono-user-c'
  const passwordC = 'hono-password-c'

  app.use(
    '/auth/*',
    basicAuth({
      username,
      password,
    })
  )
  // Test multiple handlers
  app.use('/auth/*', async (c, next) => {
    c.header('x-custom', 'foo')
    await next()
  })

  app.use(
    '/auth-unicode/*',
    basicAuth({
      username: username,
      password: unicodePassword,
    })
  )

  app.use(
    '/auth-multi/*',
    basicAuth(
      {
        username: usernameB,
        password: passwordB,
      },
      {
        username: usernameC,
        password: passwordC,
      }
    )
  )

  app.use(
    '/auth-override-func/*',
    basicAuth({
      username: username,
      password: password,
      hashFunction: (data: string) => createHash('sha256').update(data).digest('hex'),
    })
  )

  app.use('/nested/*', async (c, next) => {
    const auth = basicAuth({ username: username, password: password })
    return auth(c, next)
  })

  app.use('/verify-user/*', async (c, next) => {
    const auth = basicAuth({
      verifyUser: (username, password, c) => {
        return (
          c.req.path === '/verify-user' &&
          username === 'dynamic-user' &&
          password === 'hono-password'
        )
      },
    })
    return auth(c, next)
  })

  app.use(
    '/auth-custom-invalid-user-message-string/*',
    basicAuth({
      username,
      password,
      invalidUserMessage: 'Custom unauthorized message as string',
    })
  )

  app.use(
    '/auth-custom-invalid-user-message-object/*',
    basicAuth({
      username,
      password,
      invalidUserMessage: { message: 'Custom unauthorized message as object' },
    })
  )

  app.use(
    '/auth-custom-invalid-user-message-function-string/*',
    basicAuth({
      username,
      password,
      invalidUserMessage: () => 'Custom unauthorized message as function string',
    })
  )

  app.use(
    '/auth-custom-invalid-user-message-function-object/*',
    basicAuth({
      username,
      password,
      invalidUserMessage: () => ({ message: 'Custom unauthorized message as function object' }),
    })
  )

  app.get('/auth/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })
  app.get('/auth-unicode/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })
  app.get('/auth-multi/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })
  app.get('/auth-override-func/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })

  app.get('/nested/*', (c) => {
    handlerExecuted = true
    return c.text('nested')
  })

  app.get('/verify-user', (c) => {
    handlerExecuted = true
    return c.text('verify-user')
  })

  app.get('/auth-custom-invalid-user-message-string/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })
  app.get('/auth-custom-invalid-user-message-object/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })
  app.get('/auth-custom-invalid-user-message-function-string/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })

  app.get('/auth-custom-invalid-user-message-function-object/*', (c) => {
    handlerExecuted = true
    return c.text('auth')
  })

  it('Should not authorize', async () => {
    const req = new Request('http://localhost/auth/a')
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(handlerExecuted).toBeFalsy()
    expect(await res.text()).toBe('Unauthorized')
    expect(res.headers.get('x-custom')).toBeNull()
  })

  it('Should authorize', async () => {
    const credential = Buffer.from(username + ':' + password).toString('base64')

    const req = new Request('http://localhost/auth/a')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(handlerExecuted).toBeTruthy()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('auth')
    expect(res.headers.get('x-custom')).toBe('foo')
  })

  it('Should authorize Unicode', async () => {
    const credential = Buffer.from(username + ':' + unicodePassword).toString('base64')

    const req = new Request('http://localhost/auth-unicode/a')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(handlerExecuted).toBeTruthy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('auth')
  })

  it('Should authorize multiple users', async () => {
    let credential = Buffer.from(usernameB + ':' + passwordB).toString('base64')

    let req = new Request('http://localhost/auth-multi/b')
    req.headers.set('Authorization', `Basic ${credential}`)
    let res = await app.request(req)
    expect(handlerExecuted).toBeTruthy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('auth')

    handlerExecuted = false
    credential = Buffer.from(usernameC + ':' + passwordC).toString('base64')
    req = new Request('http://localhost/auth-multi/c')
    req.headers.set('Authorization', `Basic ${credential}`)
    res = await app.request(req)
    expect(handlerExecuted).toBeTruthy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('auth')
  })

  it('Should authorize with sha256 function override', async () => {
    const credential = Buffer.from(username + ':' + password).toString('base64')

    const req = new Request('http://localhost/auth-override-func/a')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(handlerExecuted).toBeTruthy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('auth')
  })

  it('Should authorize - nested', async () => {
    const credential = Buffer.from(username + ':' + password).toString('base64')

    const req = new Request('http://localhost/nested')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(handlerExecuted).toBeTruthy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('nested')
  })

  it('Should not authorize - nested', async () => {
    const credential = Buffer.from('foo' + ':' + 'bar').toString('base64')

    const req = new Request('http://localhost/nested')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(handlerExecuted).toBeFalsy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('Should authorize - verifyUser', async () => {
    const credential = Buffer.from('dynamic-user' + ':' + 'hono-password').toString('base64')

    const req = new Request('http://localhost/verify-user')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(handlerExecuted).toBeTruthy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('verify-user')
  })

  it('Should not authorize - verifyUser', async () => {
    const credential = Buffer.from('foo' + ':' + 'bar').toString('base64')

    const req = new Request('http://localhost/verify-user')
    req.headers.set('Authorization', `Basic ${credential}`)
    const res = await app.request(req)
    expect(handlerExecuted).toBeFalsy()
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Unauthorized')
  })

  it('Should not authorize - custom invalid user message as string', async () => {
    const req = new Request('http://localhost/auth-custom-invalid-user-message-string')
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(handlerExecuted).toBeFalsy()
    expect(await res.text()).toBe('Custom unauthorized message as string')
  })

  it('Should not authorize - custom invalid user message as object', async () => {
    const req = new Request('http://localhost/auth-custom-invalid-user-message-object')
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(res.headers.get('Content-Type')).toMatch('application/json')
    expect(handlerExecuted).toBeFalsy()
    expect(await res.text()).toBe('{"message":"Custom unauthorized message as object"}')
  })

  it('Should not authorize - custom invalid user message as function string', async () => {
    const req = new Request('http://localhost/auth-custom-invalid-user-message-function-string')
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(handlerExecuted).toBeFalsy()
    expect(await res.text()).toBe('Custom unauthorized message as function string')
  })

  it('Should not authorize - custom invalid user message as function object', async () => {
    const req = new Request('http://localhost/auth-custom-invalid-user-message-function-object')
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(res.headers.get('Content-Type')).toMatch('application/json')
    expect(handlerExecuted).toBeFalsy()
    expect(await res.text()).toBe('{"message":"Custom unauthorized message as function object"}')
  })
})
