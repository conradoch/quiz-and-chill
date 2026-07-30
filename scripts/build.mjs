import { access, mkdir, cp, rm } from "node:fs/promises";
await access("public/index.html");
await access("server.js");
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await cp("public", "dist/public", { recursive: true });
await cp("game", "dist/game", { recursive: true });
await cp("server.js", "dist/server.js");
console.log("Build completo: dist/");
