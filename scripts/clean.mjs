import { rm } from "node:fs/promises";

for (const root of ["apps/client", "apps/backend", "apps/game-server", "packages/simulation", "packages/protocol", "packages/content"]) {
  await rm(`${root}/dist`, { recursive: true, force: true });
  await rm(`${root}/web-dist`, { recursive: true, force: true });
}
