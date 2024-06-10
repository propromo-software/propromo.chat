/// <reference lib="deno.ns" />

import { ChatRoom } from "./src/controller/Chatroom.ts";
import { home } from "./src/views/home.tsx";
import { db } from "./src/database.ts";
import {
  DEV_MODE,
  JWT_PRIVATE_KEY,
  JWT_PUBLIC_KEY,
  PORT,
} from "./src/environment.ts";
import {
  cors,
  Hono,
  jwtSign,
  jwtVerify,
  logger,
  poweredBy,
  upgradeWebSocket,
  type WSContext,
} from "./deps.ts";
import { Chat } from "./src/views/chat.tsx";
// import { render } from "./deps.ts";

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
  chats: string[];
  email: string;
  exp: number;
  nbf: number;
  iat: number;
  iss: string;
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

    if (
      payload &&
      (payload.chats.includes(monitor_id) && payload.iss !== "propromo.chat")
    ) {
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
    monitor_id,
  });

  if (!usersChatting.includes(userPayload)) {
    usersChatting.push(userPayload);
  } else {
    if (DEV_MODE) {
      console.error(
        "Auth token was already used. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get your own at /login.",
      );
    }

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
        usersChatting.splice(usersChatting.indexOf(userPayload), 1);
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

  return upgradeWebSocket(createEvents)(c, async () => {});
});

/* MIDDLEWARES & ROUTES */
app.use(
  "*",
  logger(),
  poweredBy(),
  cors(),
);
app.route("", home);

type ChatInfo = {
  monitor_hash: string;
  organization_name: string;
  type: string;
  title: string;
  short_description: string;
  public: boolean;
  created_at: Date;
  updated_at: Date;
  project_url: string;
}

/* AUTHENTICATION ENDPOINT */
async function generateJWT(
  email: string | File | (string | File)[],
  password: string | File | (string | File)[],
): Promise<{
  token: string;
  chats: ChatInfo[];
}> {
  // validate user
  const response = await fetch("https://propromo-d08144c627d3.herokuapp.com/api/v1/users/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password
    }),
  });
  
  if (response.status !== 200) {
    throw new Error("Unauthorized. Password or email didn't pass the check!");
  }

  // fetch monitors
  const monitors_of_user = await db.queryObject(
    `SELECT monitor_hash, organization_name, type, title, short_description, public, created_at, updated_at, project_url 
    FROM monitors WHERE monitor_hash IN (
    SELECT monitor_hash
    FROM monitor_user mu 
    JOIN users u ON mu.user_id = u.id 
    JOIN monitors m ON mu.monitor_id = m.id 
    WHERE u.email = $1)`,
    [email],
  );

  const user_monitors = JSON.parse(JSON.stringify(monitors_of_user.rows)) as ChatInfo[];
  const user_has_monitors = monitors_of_user.rows.length >= 1;

  if (!user_has_monitors) {
    throw new Error("Unauthorized. You do not have access to any monitor!");
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await jwtSign(
    {
      chats: user_monitors,
      email,
      exp: now + 60 * 5,
      nbf: now,
      iat: now,
      iss: "propromo.chat",
    },
    JWT_OPTIONS.secret,
    JWT_OPTIONS.alg,
  );

  return {
    token,
    chats: user_monitors,
  };
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

      if (!email || !password) {
        throw new Error("Email and password are required."); // try parsing as json instead
      }

      try {
        const { token, chats } = await generateJWT(email, password);

        return c.json({
          token,
          chats,
        });
      } catch (error) {
        return c.text(error.message, 401);
      }
    });
  } catch {
    const body = await c.req.json();
    const {
      email,
      password,
    }: {
      email: string | undefined;
      password: string | undefined;
    } = body;

    if (!email || !password) {
      return c.text(
        "Email and password are required.", // not json and not form, just missing data
        400,
      );
    }

    try {
      const { token, chats } = await generateJWT(email, password);

      return c.json({
        token,
        chats,
      });
    } catch (error) {
      return c.text(error.message, 401);
    }
  }
});

let ChatNode = Chat({ token: "", monitorId: "" });
app.post("/login-view", async (c) => {
  const body = await c.req.parseBody();

  const response = await app.request("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
    }),
  });

  const { token, chats } = await response.json();

  if (response.ok) {
    ChatNode = Chat({ token, monitorId: chats[0] }); // TODO. All chats, not just the first one should be usable

    return c.html(ChatNode);
  }

  return c.text(token);
});

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, app.fetch);

// const root = document.getElementById('root') as HTMLElement;
// render(ChatNode, root);
