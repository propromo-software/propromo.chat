/** @jsx jsx */
/** @jsxFrag Fragment */

import { jsx, logger, poweredBy, serveStatic, Hono } from "../../deps.ts";
import { Layout } from "./layout.tsx";

export const home = new Hono();

home.use("*", logger(), poweredBy());
home.all("/favicon.png", serveStatic({ path: "./public/favicon.png" }));

const LogInForm = () => {
	return (
		<form action="/login-view" method="post">
			<label htmlFor="email">Email:</label>
			<input type="email" id="email" name="email" value={"username@domain.tld"} />
			<br />
			<label htmlFor="password">Password:</label>
			<input type="password" id="password" name="password" value={"password"} />
			<br />
			<label htmlFor="monitor_id">Monitor ID:</label>
			<input type="text" id="monitor_id" name="monitor_id" value={"$2y$12$W3pHWdAtePn1wjCm4.t4xO9lY9jOcu8/5SC0bDEsaAfSB8pKA5k.K"} />
			<br />
			<button type="submit">Submit</button>
		</form>
	);
};

home.get("", (c) => {
	return c.html(
		<Layout title="Login">
			<header class="container">
				<h1>Login with your Propromo Account and a valid monitor-id.</h1>
			</header>
			<main class="container">
				<LogInForm />
			</main>
		</Layout>
	);
});
