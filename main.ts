/// <reference lib="deno.ns" />

import { Hono } from 'https://deno.land/x/hono@v4.2.5/mod.ts'
import { upgradeWebSocket, jwtSign } from 'https://deno.land/x/hono@v4.2.5/helper.ts'
import { logger, poweredBy, jwt } from 'https://deno.land/x/hono@v4.2.5/middleware.ts' // https://hono.dev/middleware/builtin/jwt
import { home } from "./home.tsx"
import {
  getSignedCookie,
  setSignedCookie,
  deleteCookie,
} from 'https://deno.land/x/hono@v4.2.5/helper.ts'
import { cors } from 'https://deno.land/x/hono@v4.2.5/middleware.ts'

const JWT_SECRET = "testing"
const JWT_OPTIONS = {
  secret: JWT_SECRET, // c.env.JWT_SECRET,
  alg: "HS256" as "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512" | "ES256" | "ES384" | "ES512" | "EdDSA" | undefined
}

export const app = new Hono().route("", home)
app.use('*', logger(), poweredBy())
app.use(
  '*',
  cors()
)

/* LOGIN */
app.post('/login', (c) => {
  return c.req.parseBody().then(async (body) => {
    const token = await jwtSign(body, JWT_OPTIONS.secret, JWT_OPTIONS.alg);

    // `getSignedCookie` will return `false` for a specified cookie if the signature was tampered with or is invalid
    /* const allSignedCookies = await getSignedCookie(c, JWT_SECRET)
    const fortuneCookie = await getSignedCookie(c, JWT_SECRET, 'fortune_cookie') */

    await setSignedCookie(c, 'propromo-chat-login', token, JWT_SECRET, {
      secure: true,
      sameSite: 'Strict',
      httpOnly: true,
      path: `/chat/${body.monitor_id}`
    })

    // deleteCookie(c, 'propromo-chat-login')

    return c.json({
      body,
      token
    })
  })
})

/* CHAT */
/* CHAT GUARD */
app.use('/chat/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: JWT_OPTIONS.secret,
    cookie: 'propromo-chat-login',
    alg: JWT_OPTIONS.alg
  }) // jwtVerify() && jwtDecode()
  return jwtMiddleware(c, next)
})

/* CHAT CONNECTION INFO (GET PAYLOAD OF JWT) */
app.get('/chat/info/payload', (c) => {
  const payload = c.get('jwtPayload')
  return c.json(payload)
})

/* CHAT ROOM */
app.get('/chat/:monitor_id', upgradeWebSocket((c) => {
  const monitor_id = c.req.param('monitor_id')

  return {
    onMessage(event, ws) {
      ws.send(event.data.toString() + " in " + monitor_id)
    },
    onClose: () => {
      console.log('Connection closed')
    },
  }
}))

Deno.serve({ port: 6969 }, app.fetch)
