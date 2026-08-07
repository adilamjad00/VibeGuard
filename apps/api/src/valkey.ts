import { Redis } from "ioredis";
import { config, require_ } from "./env.js";

let client: Redis | undefined;

export function getValkey(): Redis {
  if (!client) {
    client = new Redis({
      host: config.valkey.host ?? require_("VALKEY_HOST"),
      port: config.valkey.port,
      password: config.valkey.password,
      // Health checks must fail fast and report, not hang the request.
      connectTimeout: 5_000,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    client.on("error", (err) => console.error("[valkey] connection error:", err.message));
  }
  return client;
}

export async function closeValkey(): Promise<void> {
  await client?.quit().catch(() => client?.disconnect());
  client = undefined;
}
