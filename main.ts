/// <reference lib="deno.ns" />

import { ChatRoom } from "./src/controller/Chatroom.ts";
import { home } from "./src/views/home.tsx";
import { db } from "./src/database.ts";
import {
  JWT_PRIVATE_KEY,
  JWT_PUBLIC_KEY,
  DEV_MODE,
  PORT,
} from "./src/environment.ts";
import {
  Hono,
  type WSContext,
  cors,
  jwtSign,
  jwtVerify,
  logger,
  poweredBy,
  upgradeWebSocket,
} from "./deps.ts";
import { Chat } from "./src/views/chat.tsx";
import { render } from "./deps.ts";

/* CONFIGURATION */
const app = new Hono();

const JWT_OPTIONS = {
  secret: JWT_PRIVATE_KEY ?? "",
  public: JWT_PUBLIC_KEY ?? "",
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
// Maybe replace with a redis database?
const chatRooms: Map<string, ChatRoom> = new Map();
const usersChatting: string[] = [];

type JWT_PAYLOAD = {
  monitor_id: string,
  email: string,
  exp: number,
  nbf: number,
  iat: number,
  iss: string,
};

app.get("/chat/:monitor_id", async (c) => {
  const monitor_id = decodeURIComponent(c.req.param("monitor_id"));
  let payload: JWT_PAYLOAD | undefined;
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
    payload = await jwtVerify(auth, JWT_OPTIONS.public, JWT_OPTIONS.alg);

    if (payload && (payload.monitor_id !== monitor_id || payload.iss !== "propromo.chat")) {
      if (DEV_MODE) console.error(payload);

      return c.text(
        "Auth token is invalid. Monitor ID does not match. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.",
        401,
      );
    }
  } catch (error) {
    if (DEV_MODE) console.error(error);

    return c.text(
      `Auth token is invalid. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login. (${error})`,
      401,
    );
  }

  const userPayload = JSON.stringify({
    email: payload?.email,
    monitor_id: payload?.monitor_id
  });

  if (!usersChatting.includes(userPayload)) {
    usersChatting.push(userPayload);
  } else {
    if (DEV_MODE)
      console.error(
        "Auth token was already used. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get your own at /login.",
      );

    return c.text(
      "Auth token was already used. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get your own at /login.",
      401,
    );
  }

  const createEvents = () => {
    // biome-ignore lint/style/noNonNullAssertion: ! needed, because deno-ts doesn't see, that chatRooms is created if it doesn't exist...
    let chatRoom = chatRooms.get(monitor_id)!;
    const email = payload?.email;

    if (!chatRoom) {
      chatRoom = new ChatRoom(monitor_id);
      chatRooms.set(monitor_id, chatRoom);
    }

    return {
      onMessage: async (event: MessageEvent, ws: WSContext) => {
        await chatRoom.onMessage(event, { email, ws });
      },
      onClose: () => {
        chatRoom.onClose();
        chatRooms.delete(monitor_id);
      },
      onOpen: async (_event: Event, ws: WSContext) => {
        await chatRoom.onOpen(ws);
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
  cors(),
);
app.route("", home);

/* AUTHENTICATION ENDPOINT */
async function generateJWT(
  email: string | File | (string | File)[],
  password: string | File | (string | File)[],
  monitor_id: string | File | (string | File)[],
): Promise<string> {
  /* const users_that_match = await db.queryObject(
    `SELECT user_id FROM monitor_user mu 
    JOIN users u ON mu.user_id = u.id 
    JOIN monitors m ON mu.monitor_id = m.id 
    WHERE u.email = $1 
    AND u.password = $2
    AND m.monitor_hash = $3`,
    [email, password, monitor_id],
  ); */
  const user_has_access = true; // users_that_match.rows.length === 1;

  if (!user_has_access) {
    throw new Error("Unauthorized. You do not have access to that monitor.");
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await jwtSign(
    {
      monitor_id,
      email,
      exp: now + 60 * 5,
      nbf: now,
      iat: now,
      iss: "propromo.chat",
    },
    JWT_OPTIONS.secret,
    JWT_OPTIONS.alg,
  );

  return token;
}

/**
 * Supports form data with content-type: application/x-www-form-urlencoded or multipart/form-data as well as application/json as response body.
 */
app.post("/login", async (c) => {
  try {
    // only works if sent by a form, not if form is simulated with FormData as body and content-type: application/x-www-form-urlencoded or multipart/form-data
    return await c.req.parseBody().then(async (body) => {
      const email = body?.email;
      const password = body?.password;
      const monitor_id = body?.monitor_id;

      if (!email || !password || !monitor_id) {
        throw new Error("Email, password and monitor-id are required."); // try parsing as json instead
      }

      try {
        return c.text(await generateJWT(email, password, monitor_id));
      } catch (error) {
        return c.text(error.message, 401);
      }
    });
  } catch {
    const body = await c.req.json();
    const {
      email,
      password,
      monitor_id,
    }: {
      email: string | undefined;
      password: string | undefined;
      monitor_id: string | undefined;
    } = body;

    if (!email || !password || !monitor_id) {
      return c.text(
        "Email, password and monitor-id are required.", // not json and not form, just missing data
        400,
      );
    }

    try {
      return c.text(await generateJWT(email, password, monitor_id));
    } catch (error) {
      return c.text(error.message, 401);
    }
  }
});

let ChatNode = Chat({ token: "", monitorId: "" });
app.post("/login-view", async (c) => {
  const body = await c.req.parseBody();

  const response = await app.request('/login', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      monitor_id: body.monitor_id
    }),
  });

  const token = await response.text();

  if (response.ok) {
    const monitorId = body.monitor_id as string;
    ChatNode = Chat({ token, monitorId });

    return c.html(ChatNode);
  }

  return c.text(token);
});

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, app.fetch);

// const root = document.getElementById('root') as HTMLElement;
// render(ChatNode, root);
