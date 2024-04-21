import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { DATABASE_URL } from "./environment.ts";

// postgres://user:password@localhost:5432/test?application_name=my_custom_app&sslmode=require
export const db = new Client(DATABASE_URL);
await db.connect();

// await client.end();
