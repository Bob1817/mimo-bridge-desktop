import { createBridgeApp } from "./bridge-server-factory.js";
import { loadConfig } from "./bridge-core.js";

const cfg = loadConfig();
const app = createBridgeApp({ logger: (line) => console.log(`[bridge] ${line}`) });

app.listen(cfg.port, () => {
  console.log(`MIMO Bridge Server started: http://localhost:${cfg.port}`);
});
