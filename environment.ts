import { load } from "./deps.ts";

const env = await load();
export const DEV_MODE = env.DEV_MODE === "true";
export const PORT = Number.parseInt(env.PORT ?? "6969");
export let JWT_PRIVATE_KEY: string | undefined = env.JWT_PRIVATE_KEY;
export let JWT_PUBLIC_KEY: string | undefined = env.JWT_PUBLIC_KEY;
export let DATABASE_URL: string | undefined = env.DATABASE_URL;

// Check for variables in the process, if there is no .env file present
if (!JWT_PRIVATE_KEY ||
    (JWT_PRIVATE_KEY && JWT_PRIVATE_KEY.trim().length === 0) ||
    !JWT_PUBLIC_KEY ||
    (JWT_PUBLIC_KEY && JWT_PRIVATE_KEY.trim().length === 0) ||
    !DATABASE_URL ||
    (DATABASE_URL && DATABASE_URL.trim().length === 0)
) {
    JWT_PRIVATE_KEY = Deno.env.get("JWT_SECRET");
    JWT_PUBLIC_KEY = Deno.env.get("JWT_PUBLIC_KEY");
    DATABASE_URL = Deno.env.get("DATABASE_URL");

    if (!JWT_PRIVATE_KEY) {
        throw new Error("JWT_SECRET is not set");
    }

    if (!JWT_PUBLIC_KEY) {
        throw new Error("JWT_PUBLIC_KEY is not set");
    }

    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }
}
