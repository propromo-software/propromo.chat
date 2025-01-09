import { load } from "../deps.ts";

const env = await load({
    allowEmptyValues: true // so that it does not crash, if there is no .env file, and the environment variables can be used
});
export let DEV_MODE = env.DEV_MODE === "true";
export let PORT = Number.parseInt(env.PORT ?? "6969");
export let JWT_PRIVATE_KEY: string | undefined = env.JWT_PRIVATE_KEY;
export let JWT_PUBLIC_KEY: string | undefined = env.JWT_PUBLIC_KEY;
export let DATABASE_URL: string | undefined = env.DATABASE_URL;
export let CHAT_STORAGE_URL: string | undefined = env.CHAT_STORAGE_URL;
export let CHAT_STORAGE_TOKEN: string | undefined = env.CHAT_STORAGE_TOKEN;

// Check for variables in the process, if there is no .env file present
if (!JWT_PRIVATE_KEY ||
    (JWT_PRIVATE_KEY && JWT_PRIVATE_KEY.trim().length === 0) ||
    !JWT_PUBLIC_KEY ||
    (JWT_PUBLIC_KEY && JWT_PUBLIC_KEY.trim().length === 0) ||
    !DATABASE_URL ||
    (DATABASE_URL && DATABASE_URL.trim().length === 0) ||
    !CHAT_STORAGE_URL ||
    (CHAT_STORAGE_URL && CHAT_STORAGE_URL.trim().length === 0) ||
    !CHAT_STORAGE_TOKEN ||
    (CHAT_STORAGE_TOKEN && CHAT_STORAGE_TOKEN.trim().length === 0)
) {
    JWT_PRIVATE_KEY = Deno.env.get("JWT_PRIVATE_KEY");
    JWT_PUBLIC_KEY = Deno.env.get("JWT_PUBLIC_KEY");
    DATABASE_URL = Deno.env.get("DATABASE_URL");
    CHAT_STORAGE_URL = Deno.env.get("CHAT_STORAGE_URL");
    CHAT_STORAGE_TOKEN = Deno.env.get("CHAT_STORAGE_TOKEN");

    if (!JWT_PRIVATE_KEY) {
        throw new Error("JWT_SECRET is not set");
    }

    if (!JWT_PUBLIC_KEY) {
        throw new Error("JWT_PUBLIC_KEY is not set");
    }

    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    if (!CHAT_STORAGE_URL) {
        throw new Error("CHAT_STORAGE_URL is not set");
    }

    if (!CHAT_STORAGE_TOKEN) {
        throw new Error("CHAT_STORAGE_TOKEN is not set");
    }
}

if (Deno.env.has("DEV_MODE")) {
    DEV_MODE = Deno.env.get("DEV_MODE") === "true";
}

if (Deno.env.has("PORT")) {
    PORT = Number.parseInt(Deno.env.get("PORT") ?? "10000");
}
