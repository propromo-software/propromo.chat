# Propromo Chat

<https://s0qb102l.status.cron-job.org>

## Deployments

* <https://chat-app-latest-m6ht.onrender.com>
* <https://propromo-chat-c575fve9ssfr.deno.dev>

## Description

A chat application for Propromo.

### API

| Title         | Path                     | Description                                                          | Type  | Parameters to pass and other notes                      |
| ------------- | ------------------------ | -------------------------------------------------------------------- | ----- | ------------------------------------------------------- |
| **Home**      | `/`                      | The home page of the application.                                    | GET   | None                                                    |
|               |                          | Can be used to **test** if an account has access to a chat.          |       |                                                         |
|               |                          | Returns a token, on login, if they have access, and an Error if not. |       |                                                         |
| **Chat Room** | `/chat/:monitor_id?auth` | The WebSocket endpoint for a specific **chat room**.                 | WS\|S | A `monitor_id` **url parameter**, and an                |
|               |                          | **Requires** a JWT token for authentication.                         |       | `auth` **query** parameter containing the JWT token.    |
| **Login**     | `/login`                 | The endpoint to obtain a JWT token for **authentication**.           | POST  | The request body should contain:                        |
|               |                          | **Requires** an existing [propromo](propromo.duckdns.org) account.   |       | **email** and **password**, fields.     |
|               |                          | Tokens expire after 5 min. and can only be used once.                |       | Content type can be `application/x-www-form-urlencoded` |
|               |                          |                                                                      |       | or `multipart/form-data` as well as `application/json`. |

_Chat connections stay open till they are closed by the client, just the token expires._

> INFO: `./dummy/test.sql` and `/` can be used for testing purposes.

#### API Collections

##### Poor support for WebSocket Connections in Postman

<https://community.postman.com/t/websocket-and-rest-requests-in-same-collection/55471>
<https://github.com/postmanlabs/postman-app-support/issues/11252>

##### Path Parameters do not work in Insomnia

<https://github.com/Kong/insomnia/issues/7314>

### Server Commands

#### Running

```bash
deno task start
```

```bash
docker-compose -f redis.yml up
```

#### Building

```bash
docker build -t app . && docker run -it -p 1993:1993 app
```

### Keys

#### RS512 (for production)

Use `keys.sh` or one of the commands.

##### private.pem

Generates a private key with a 4096-bit RSA key and SHA-512 digest, but it does not generate a certificate. The private key is encrypted with AES-256 and output to the private.pem file.

```bash
openssl genpkey -algorithm RSA -out private.pem -aes256 -pkeyopt rsa_keygen_bits:4096 -pkeyopt digest:sha512
```

or

Generates a self-signed X.509 certificate with a 4096-bit RSA key and SHA-512 digest. The private key is encrypted with the specified digest algorithm and output to the private.pem file.

```bash
openssl req -x509 -newkey rsa:4096 -keyout private.pem -out private.pem -days 3650 -nodes -subj '/CN=propromo.chat' -sha512
```

###### Check

```bash
openssl rsa -in private.pem -check
```

##### public.pem

The public key is not generated separately, but it can be extracted from the private key using the `openssl rsa` command with the `-pubout` option, like this:

```bash
openssl rsa -in private.pem -pubout -outform PEM -out public.pem
```

or

The public key is embedded in the self-signed X.509 certificate that is generated along with the private key.

```bash
openssl x509 -in private.pem -pubkey -noout > public.pem
```

#### HS256 (for development)

```bash
openssl rand -base64 32
```

### Authentication

Why is the query parameter used for authentication?  
The problem: Websockets are not built with much security in mind.

I think this is the best solution to authenticate, after cookies, and they don't work well together with some clients like postman :/.  
First get a token at /login and then validate it here. The token expires after 5 minutes and can only be used once.
Unlike HTTP URLs, wss: URLs are never exposed to the user.

* Users can't bookmark them or copy-and-paste them. This minimizes the risk of accidental sharing.
* In addition, their appearance in other web APIs is minimal.
  * For example, they won't appear in history. This reduces the risk of leakage via JS APIs.
* The risk is reduced even more, because the token is only valid for 5 minutes. (_the connection stays open, it can only be opened only 5 minutes after token creation_).

When it comes to authentication for Websockets, every solution you choose has its own trade-offs.
