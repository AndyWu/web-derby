import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = (await readdir("dist/assets", { recursive: true }))
  .filter((file) => /\.[^/]+$/.test(file))
  .sort();
const assets = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  ...files.map((file) => "/assets/" + file),
];
const worker = await readFile("public/sw.js", "utf8");
const hash = createHash("sha256").update(worker);
for (const file of assets.filter((path) => path !== "/"))
  hash.update(file).update(await readFile("dist" + file));
const version = hash.digest("hex").slice(0, 20);
const manifest = JSON.stringify({ version, assets });
await writeFile("dist/cache-manifest.json", manifest);
await writeFile(`dist/cache-manifest.${version}.json`, manifest);
await writeFile(
  "dist/sw.js",
  worker.replace("__DERBY_BUILD_VERSION__", version),
);
