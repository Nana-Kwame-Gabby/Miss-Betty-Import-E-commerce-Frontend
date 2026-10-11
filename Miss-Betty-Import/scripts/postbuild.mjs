// Vercel serves real files before applying rewrites, so a dist/index.html would make "/"
// skip the SEO renderer (api/seo.js). Rename the app shell; vercel.json rewrites routes to it.
import { renameSync, existsSync } from "node:fs";

if (existsSync("dist/index.html")) {
  renameSync("dist/index.html", "dist/app.html");
  console.log("postbuild: dist/index.html -> dist/app.html");
}
