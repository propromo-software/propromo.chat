/** @jsx jsx */
/** @jsxFrag Fragment */

import { Hono } from 'https://deno.land/x/hono@v4.2.5/mod.ts'
import { logger, poweredBy, jsx, serveStatic } from 'https://deno.land/x/hono@v4.2.5/middleware.ts'
import { html } from "https://deno.land/x/hono@v4.2.5/helper/html/index.ts";

type Props = {
    title: string
    children?: any
}

const Layout = (props: Props) => html`<!DOCTYPE html>
  <html>
    <link
      type="image/png"
      rel="icon"
      href="/favicon.png"
    />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
    />
    <head>
      <title>${props.title}</title>
    </head>
    <body>
      ${props.children}
    </body>
  </html>`

export const home = new Hono()

home.use('*', logger(), poweredBy())
home.all('/favicon.png', serveStatic({ path: './public/favicon.png' }))

const LogInForm = () => {
  return (
    <form action="/login" method="post">
      <label htmlFor="email">Email:</label>
      <input type="email" id="email" name="email" />
      <br />
      <label htmlFor="password">Password:</label>
      <input type="password" id="password" name="password" />
      <br />
      <label htmlFor="monitor_id">Monitor ID:</label>
      <input type="text" id="monitor_id" name="monitor_id" />
      <br />
      <button type="submit">Submit</button>
    </form>
  );
};

home.get('', (c) => {
    return c.html(
      <Layout title="Login">
        <header class="container">
        <h1>Login with your Propromo Account and a valid monitor-id.</h1>
        </header>
        <main class="container">
          <LogInForm />
        </main>
      </Layout>
    )
  })
