/** @jsx jsx */
/** @jsxFrag Fragment */
/// <reference lib="dom" />

// import { jsx as _jsx } from "https://deno.land/x/hono@v4.3.1/jsx/dom/jsx-runtime.ts"; 
// Specifying it in deno.json doesn't work, because the path ends up as https://deno.land/x/hono@v4.2.5/jsx/dom/jsx-runtime without the .ts extension deno needs.
// Other option, using the imports attribute causes error: Unsupported 'jsx' compiler option value 'precompile'. Supported: 'react-jsx', 'react-jsxdev', 'react'
/* 
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "hono/jsx"
	},
	"imports": {
		"hono/jsx/jsx-runtime": "https://deno.land/x/hono@v4.3.1/jsx/jsx-runtime.ts"
	}

  "compilerOptions": {
		"jsx": "precompile",
		"jsxImportSource": "hono/jsx/dom"
	},
	"imports": {
		"hono/jsx/dom/jsx-runtime": "https://deno.land/x/hono@v4.3.1/jsx/jsx-runtime.ts"
	}
*/


import { jsx, useState, useEffect, /* render, */ FC } from "../../deps.ts";
import { Layout } from "./layout.tsx";
import type { ChatInfo } from "../types.ts";

interface ChatFormProps {
  credentials: {
    token: string;
    monitor_hash: string;
  };
}

const ChatForm: FC<ChatFormProps> = ({ credentials }) => {
  const [message, setMessage] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const token = credentials.token;
  const monitorId = encodeURIComponent(credentials.monitor_hash);

  useEffect(() => {
    const ws = new WebSocket(`/chat/${monitorId}?auth=${token}`);
    setWs(ws);

    ws.onopen = () => {
      console.log("Connected to WebSocket");
    };

    ws.onmessage = (event) => {
      console.log(`Received message: ${event.data}`);
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
  }, [credentials]);

  const handleSubmit = (event: Event) => {
    event.preventDefault();
      
    if (ws) {
      ws.send(message);
      setMessage("");
    }
  };

    return (
    <form onSubmit={handleSubmit}>
      {/* <p style={{ textAlign: "right" }}><b><strong>token</strong> used:</b> {token}</p> */}
      <label htmlFor="message">Message:</label>
      <input
        type="text"
        id="message"
        name="message"
        value={message}
          onChange={(event) => {
            if (event?.target && event?.target && "value" in event.target) {
                setMessage(event?.target?.value as string);
            }
        }}
      />
      <br />
      <button type="submit">Send</button>
    </form>
  );
};

interface ChatProps {
  token: string;
  chats: ChatInfo[];
}

export const Chat: FC<ChatProps> = ({ token, chats }: ChatProps) => {
    return (
    <Layout title="Login">
      <header className="container">
        <h1>All Chats</h1>
      </header>
      <main className="container">
        {chats.map(chat => (
          <div key={chat.monitor_hash}>
            <h2>{chat.title}</h2>
            <p>{chat.short_description}</p>
            <p>Organization: {chat.organization_name}</p>
            <p>Type: {chat.type}</p>
            <p>Created at: {new Date(chat.created_at).toLocaleDateString()}</p>
            <p>Updated at: {new Date(chat.updated_at).toLocaleDateString()}</p>
            <p>Public: {chat.public ? "Yes" : "No"}</p>
            <p>Project URL: <a href={chat.project_url} target="_blank" rel="noopener noreferrer">{chat.project_url}</a></p>
            <ChatForm credentials={{ token, monitor_hash: chat.monitor_hash as string }} />
            <hr />
          </div>
        ))}
      </main>
		</Layout>
    );
}
