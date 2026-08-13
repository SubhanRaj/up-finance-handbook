import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Content is served dynamically from D1 on every request (src/lib/content.ts) —
// no incremental/ISR cache needed, so no R2/KV override here.
export default defineCloudflareConfig({});
