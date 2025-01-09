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
  //  swaggerUI,
  upgradeWebSocket,
  type WSContext,
} from "./deps.ts";
import { Chat } from "./src/views/chat.tsx";
import { ChatInfo, JWT_PAYLOAD } from "./src/types.ts";
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

function logInfo(message: string, detail: object | null = null) {
  if (DEV_MODE) console.info(`[${new Date().toISOString()}] ${message}${detail ? ` (${JSON.stringify(detail)})` : ""}`);
}

function logError(message: string, detail: object | null = null, error: Error | null = null) {
  if (DEV_MODE) console.error(`[${new Date().toISOString()}] ${message}${detail ? ` (${JSON.stringify(detail)}, ${JSON.stringify(error)})` : ""}`);
}

app.get("/chat/:monitor_id", async (c) => {
  const monitor_id = c.req.param("monitor_id");
  let payload: JWT_PAYLOAD | undefined;
  const auth = c.req.query("auth");
  const token = auth ? auth?.trim() : null;

  logInfo(`Path '/chat/${monitor_id}?auth=${token}' called.`, { monitor_id, token });

  const authTokenIsSet = !!token;
  const authTokenIsNotEmpty = authTokenIsSet && (token?.length > 0);
  const detail = {
    authTokenIsSet,
    authTokenIsNotEmpty
  }
  if (!authTokenIsSet || !authTokenIsNotEmpty) {
    logInfo("Query parameter ?auth={jwt} is not set or empty.", detail);

    return c.json({
      success: false,
      message: "Auth token is required. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.",
      detail
    }, 400);
  }

  try {
    logInfo("Checking if jwt is valid.");
    payload = await jwtVerify(token, JWT_OPTIONS.public, JWT_OPTIONS.alg);

    const payloadIsSet =
      !!payload &&
      !!payload?.chats;
    const payloadContainsMonitors =
      payload &&
      payload.chats &&
      payload.chats.some(chat => chat.monitor_hash === monitor_id);
    const payloadHasCorrectIssuer = payload?.iss === "propromo.chat";
    const detail = {
      payload,
      payloadIsSet,
      payloadContainsMonitors,
      payloadHasCorrectIssuer
    }

    if (
      !payloadIsSet ||
      !payloadContainsMonitors ||
      !payloadHasCorrectIssuer
    ) {
      logError("Auth token is invalid. Monitor ID does not match. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.", detail);

      return c.json({
        success: false,
        message: "Auth token is invalid. Monitor ID does not match. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.",
        detail
      }, 401);
    }
  } catch (error) {
    logError("Auth token is invalid. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.", detail, error);

    return c.json({
      success: false,
      message: "Auth token is invalid. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get one at /login.",
      detail,
      error
    }, 401);
  }

  const userPayload = JSON.stringify({
    email: payload?.email as string,
    monitor_id
  });

  if (!usersChatting.includes(userPayload)) {
    usersChatting.push(userPayload);
  } else {
    logError("Auth token was already used. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get your own at /login.");

    return c.json({
      success: false,
      message: "Auth token was already used. /chat/:monitor_id?auth=<YOUR_AUTH_TOKEN>. Get your own at /login.",
      detail
    }, 403);
  }

  const createEvents = () => {
    // biome-ignore lint/style/noNonNullAssertion: ! needed, because deno-ts doesn't see, that chatRooms is created if it doesn't exist...
    let chatRoom = chatRooms.get(monitor_id)!;
    const email = payload?.email;

    if (!chatRoom) {
      logInfo("Creating new chatroom.", { monitor_id });

      chatRoom = new ChatRoom(monitor_id);
      chatRooms.set(monitor_id, chatRoom);
    }

    return {
      onMessage: async (event: MessageEvent, ws: WSContext) => {
        const messageWithoutSpaces = event.data.replace(/\s+/g, '');
        if (messageWithoutSpaces != "propromo.chat({event:\"ping\",action:\"pong\"})" &&
          messageWithoutSpaces != "propromo.chat({event:\"pong\",action:\"ping\"})") {
          logInfo(`Received message from ${email} in ${monitor_id}.`, { ws, message: event.data });
        }

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
): Promise<{
  token: string;
  chats: ChatInfo[];
}> {
  logInfo("Logging in, validating user credentials.", { email, password });

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

  const json = await response.json();
  logInfo("Login response: ", json);

  if (!json.success) {
    logError("Unauthorized. Password or email didn't pass the check!", json);
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
  const detail = {
    user_monitors,
    user_has_monitors
  }

  logInfo("User monitors: ", detail);

  if (!user_has_monitors) {
    logError("Unauthorized. You do not have access to any monitor!", detail);
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
    } as JWT_PAYLOAD,
    JWT_OPTIONS.secret,
    JWT_OPTIONS.alg,
  );

  logInfo("Token generated. ", { token });

  return {
    token,
    chats: user_monitors,
  };
}

async function validateCredentials(
  email: string | File | (string | File)[] | undefined,
  password: string | File | (string | File)[] | undefined,
  dataFormat: "form-data" | "json",
  c: any) {
  if (!email || !password) {
    if (dataFormat === "json") {
      logError("Email and password are required in the json request body.", { email, password });

      return c.json({
        success: false,
        message: "Email and password are required.",
        detail: { email, password }
      }, 400);
    }

    throw new Error("Trying to parse the request body as json instead.");
  }

  try {
    logInfo("Login endpoint, validating user credentials. Generating JWT.", { email, password });
    const { token, chats } = await generateJWT(email as string, password as string);

    return c.json({
      token,
      chats
    });
  } catch (error) {
    if (dataFormat === "json") {
      logError(`Error at /login?${dataFormat}.`, { email, password }, error);

      return c.json({
        success: false,
        message: "Email and/or password is invalid.",
        detail: { email, password },
        error
      }, 401);
    }

    throw new Error("Trying to parse the request body as json instead.");
  }
}

/**
 * Supports form data with content-type: application/x-www-form-urlencoded or multipart/form-data as well as application/json as response body.
 */
app.post("/login", async (c) => {
  try { // On Error, trying to parse json instead...
    // only works if sent by a form, not if form is simulated with FormData as body and content-type: application/x-www-form-urlencoded or multipart/form-data
    return await c.req.parseBody().then(async (body) => {
      const email = body?.email;
      const password = body?.password;

      return await validateCredentials(email, password, "form-data", c);
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

    return await validateCredentials(email, password, "json", c);
  }
});

let ChatNode = Chat({ token: "", chats: [] });
app.post("/login-view", async (c) => {
  logInfo("Rendering login view.");
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
    logInfo("Login successful. Rendering chat view.", { email: body.email, password: body.password });
    ChatNode = Chat({ token, chats });

    return c.html(
      `<script type="module">
      import React from "https://esm.sh/react@19.0.0-beta-04b058868c-20240508/?dev"
      import ReactDOMClient from "https://esm.sh/react-dom@19.0.0-beta-04b058868c-20240508/client/?dev"

      window.onload = () => {
        const rootElement = ReactDOMClient.createRoot(document.getElementById('root'));
        rootElement.render(ChatNode);
      };
      </script>`
      + ChatNode);
  }

  logError("Error at /login-view.", { email: body.email, password: body.password });

  return c.json({
    success: false,
    message: "Error at /login-view.",
    detail: { email: body.email, password: body.password },
  });
});

// app.get('/swagger', swaggerUI({ url: '/doc' }));

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, app.fetch);
