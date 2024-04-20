/// <reference lib="deno.ns" />

import { Hono } from "https://deno.land/x/hono@v4.2.5/mod.ts";
import type { WSContext } from "https://deno.land/x/hono@v4.2.5/helper/websocket/index.ts";
import {
  jwtSign,
  jwtVerify,
  upgradeWebSocket,
} from "https://deno.land/x/hono@v4.2.5/helper.ts";
import {
  logger,
  poweredBy,
  cors,
} from "https://deno.land/x/hono@v4.2.5/middleware.ts";
import { ChatRoom } from "./Chatroom.ts";
import { home } from "./home.tsx";
import { db } from "./database.ts";

//#region Why Websockets suck (https://github.com/whatwg/websockets/issues/16)
// Why not socket.io? (https://github.com/socketio/socket.io/tree/main?tab=readme-ov-file#room-support):
// Socket.IO is not a WebSocket implementation.
// Although Socket.IO indeed uses WebSocket as a transport when possible, it adds some metadata to each packet:
// the packet type, the namespace and the ack id when a message acknowledgement is needed.
// That is why a WebSocket client will not be able to successfully connect to a Socket.IO server,
// and a Socket.IO client will not be able to connect to a WebSocket server (like ws://echo.websocket.org) either. Please see the protocol specification here.

// Why no authentication with cookies? - https://significa.co/blog/using-websockets-with-cookie-based-authentication, basically the only "good" option, but it sucks.
// WebSockets are not subject to same-origin policy (because apparently every little thing about WebSockets has to be awful)
// and allowing cookies would leave you wide open to CSRF attacks.

// Why not open a WebSocket without authenticating, and authenticate in it?
// And then send auth information over WebSocket prior to doing anything else.
// This in theory sounds logical (and is advised by the browser vendors),
// but falls apart given just a cursory thought. The server is made to implement an awkward,
// highly stateful and entirely custom authentication mechanism that doesn't play well with anything else,
// on top of either having to maintain a persistent connection with a client who refuses to authenticate,
// leaving a door wide open for denial of service attacks,
// or getting into a whole new rabbit whole of enforcing rigorous time outs to prevent malicious behavior.

// Postman can somehow send headers for the handshake, the Websocket API can not do that.
// Maybe it smuggles the token?
// Since the only header a browser will let you control is Sec-WebSocket-Protocol, you can abuse it to emulate any other header.
// Interestingly (or rather comically), this is what Kubernetes is doing. In short, you append whatever you need for authentication
// as an extra supported subprotocol inside Sec-WebSocket-Protocol: var ws = new WebSocket("ws://example.com/path", ["realProtocol", "yourAccessTokenOrSimilar"]);
// But that can not be the case since honos jwt middleware got it from a header with the name Authorization, which is a header that can only be set for http,
// meaning Postman somehow figured out how to set it in the handshake.
// Postman doesn't allow this, that is why I don't wan't to use it. Without a api client testing software, it will be a pain. (https://github.com/whatwg/websockets/issues/16#issuecomment-1997491158)

// What I chose: Short lived jwt tokens, that can be obtained at /login, and only work for 5 Minutes and for one time.
//#endregion

/* CONFIGURATION */
const app = new Hono();
const JWT_PRIVATE_KEY = "testing"; // c.env.JWT_SECRET
const JWT_PUBLIC_KEY = "testing";
const JWT_OPTIONS = {
  secret: JWT_PRIVATE_KEY,
  public: JWT_PUBLIC_KEY,
  alg: "HS256" as
    | "HS256"
    | "HS384"
    | "HS512"
    | "RS256"
    | "RS384"
    | "RS512"
    | "PS256"
    | "PS384"
    | "PS512"
    | "ES256"
    | "ES384"
    | "ES512"
    | "EdDSA"
    | undefined,
};

/* CHAT */

/* CHATROOM */
const chatRooms: Map<string, ChatRoom> = new Map();
const jwts: string[] = [];
app.get("/chat/:monitor_id", async (c) => {
  const monitor_id = c.req.param("monitor_id");
  const auth = c.req.query("auth");

  // I think this is the best solution to authenticate, after cookies, and they don't work well together with postman :/.
  // First get a token at /login and then validate it here. The token expires after 5 minutes and can only be used once.
  // Unlike HTTP URLs, wss: URLs are never exposed to the user.
  // They can't bookmark them or copy-and-paste them. This minimises the risk of accidental sharing.
  // In addition, their appearance in other web APIs is minimal [1]. For example, they won't appear in history. This reduces the risk of leakage via JS APIs.
  // The risk is reduced even more, because the token is only valid for 5 minutes. (the connection stays open, it can only be opened only 5 minutes after token creation).
  if (!auth || !(auth && auth?.trim()?.length > 0)) {
    return c.text(
      "Auth token is required. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.",
      401,
    );
  }

  try {
    const payload = await jwtVerify(auth, JWT_OPTIONS.public, JWT_OPTIONS.alg);

    if (payload.monitor_id !== monitor_id || payload.iss !== "propromo.chat") {
      // console.error(payload);
      return c.text(
        "Auth token is invalid. Monitor ID does not match. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.",
        401,
      );
    }
  } catch (error) {
    // console.error(error);
    return c.text(
      `Auth token is invalid. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login. (${error})`,
      401,
    );
  }

  if (!jwts.includes(auth)) {
    jwts.push(auth);
  } else {
    return c.text(
      "Auth token was already used. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get your own at /login.",
      401,
    );
  }

  const createEvents = () => {
    let chatRoom = chatRooms.get(monitor_id);
    if (!chatRoom) {
      chatRoom = new ChatRoom(monitor_id);
      chatRooms.set(monitor_id, chatRoom);
    }

    return {
      onMessage: (event: MessageEvent) => {
        chatRoom.onMessage(event);
      },
      onClose: () => {
        chatRoom.onClose();
        chatRooms.delete(monitor_id);
      },
      onOpen: (_event: Event, ws: WSContext) => {
        chatRoom.onOpen(ws);
      },
      onError: () => {
        chatRoom.onError();
      },
    };
  };

  return upgradeWebSocket(createEvents)(c, async () => { });
});

/* MIDDLEWARES & ROUTES */
app.use(
  "*",
  logger(),
  poweredBy(),
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
  }),
);
app.route("", home);

/* AUTHENTICATION ENDPOINT */
app.post("/login", (c) => {
  return c.req.parseBody().then(async (body) => {
    const email = body?.email ?? "";
    const password = body?.password ?? "";
    const monitor_id = body?.monitor_id ?? "";

    if (!email || !password || !monitor_id) {
      return c.text("Email, password and monitor-id are required.", 400);
    }

    const users_that_match = await db.queryObject(
      `SELECT user_id FROM monitor_user mu 
      JOIN users u ON mu.user_id = u.id 
      JOIN monitors m ON mu.monitor_id = m.id 
      WHERE u.email = $1 
      AND u.password = $2
      AND m.monitor_hash = $3`,
      [email, password, monitor_id],
    );
    const user_has_access = users_that_match.rows.length === 1;

    if (!user_has_access) {
      return c.text(
        "Unauthorized. You do not have access to that monitor.",
        401,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await jwtSign(
      {
        monitor_id,
        exp: now + 60 * 5,
        nbf: now,
        iat: now,
        iss: "propromo.chat",
      },
      JWT_OPTIONS.secret,
      JWT_OPTIONS.alg,
    );

    return c.text(token);
  });
});

Deno.serve({ port: 6969 }, app.fetch);
