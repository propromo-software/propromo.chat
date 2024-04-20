/// <reference lib="deno.ns" />

import { Hono } from 'https://deno.land/x/hono@v4.2.5/mod.ts'
import { upgradeWebSocket, jwtSign } from 'https://deno.land/x/hono@v4.2.5/helper.ts'
import { logger, poweredBy, jwt } from 'https://deno.land/x/hono@v4.2.5/middleware.ts'
import { home } from "./home.tsx"
import {
  getSignedCookie,
  setSignedCookie,
  deleteCookie,
} from 'https://deno.land/x/hono@v4.2.5/helper.ts'
import { cors } from 'https://deno.land/x/hono@v4.2.5/middleware.ts'

/* CONFIGURATION */
export const app = new Hono()
const JWT_SECRET = "testing" // c.env.JWT_SECRET
const JWT_OPTIONS = {
  secret: JWT_SECRET,
  alg: "HS256" as "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512" | "ES256" | "ES384" | "ES512" | "EdDSA" | undefined
}

/* CHAT */
/* CHAT GUARD */
app.use('/chat/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: JWT_OPTIONS.secret,
    cookie: 'propromo-chat-login',
    alg: JWT_OPTIONS.alg
  }) // jwtVerify() && jwtDecode() // should work with headers like Authorization: Bearer <token> and cookies: await getSignedCookie(c, JWT_SECRET, 'propromo-chat-login')
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
    onOpen: () => {
      console.log('Connection opened')
    },
    onError: () => {
      console.log('Connection errored')
    }
  }
}))

/* MIDDLEWARES & ROUTES */
app.use('*', logger(), poweredBy(), cors({
  origin: ['127.0.0.1:5173'],
}))
app.route("", home)

/* LOGIN */
app.post('/login', (c) => {
  return c.req.parseBody().then(async (body) => {
    const token = await jwtSign({
      monitor_id: body.monitor_id // email and password is only needed for initial validation, after that the token is the validation
    }, JWT_OPTIONS.secret, JWT_OPTIONS.alg);

    deleteCookie(c, 'propromo-chat-login')
    await setSignedCookie(c, 'propromo-chat-login', "Bearer " + token, JWT_SECRET, {
      domain: '127.0.0.1:6969',
      secure: true,
      sameSite: 'Lax',
      httpOnly: true,
      path: `/chat/${body.monitor_id}`
    })

    return c.json({
      body,
      token
    })
  })
})

Deno.serve({ port: 6969 }, app.fetch)
