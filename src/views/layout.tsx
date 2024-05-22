import { html } from "../../deps.ts";

type Props = {
	title: string;
	// biome-ignore lint/suspicious/noExplicitAny: Sometimes I want my any :)
	children?: any;
};

export const Layout = (props: Props) => html`<!DOCTYPE html>
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
  </html>`;