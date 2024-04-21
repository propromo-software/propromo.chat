import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";

const env = await load();
export const DEV_MODE = env.DEV_MODE === "true";
export const PORT = Number.parseInt(env.PORT ?? "6969");
export const JWT_PRIVATE_KEY = env.JWT_PRIVATE_KEY;
export const JWT_PUBLIC_KEY = env.JWT_PUBLIC_KEY;
export const DATABASE_URL = env.DATABASE_URL;

if (!JWT_PRIVATE_KEY) {
    throw new Error("JWT_SECRET is not set");
}

if (!JWT_PUBLIC_KEY) {
    throw new Error("JWT_PUBLIC_KEY is not set");
}

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}
