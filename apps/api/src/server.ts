import { createApp } from "./app.js";
import { env } from "./config/env.js";

// Bootstrap: único lugar que sobe o servidor HTTP.
const app = createApp();

app.listen(env.apiPort, () => {
  console.log(`amococ-api ouvindo na porta ${env.apiPort}`);
});
