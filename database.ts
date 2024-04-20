import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

export const db = new Client("postgresql://postgres:propromo@localhost:54320/propromo"); // postgres://user:password@localhost:5432/test?application_name=my_custom_app&sslmode=require
await db.connect();

// await client.end();
