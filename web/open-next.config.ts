import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Every content page is prerendered at build time (generateStaticParams) —
// this cache just persists that generated HTML so the worker doesn't need
// to re-render on every request. Needs the R2 bucket bound in wrangler.jsonc
// (`wrangler r2 bucket create up-finance-handbook-cache` once, before first deploy).
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
});
