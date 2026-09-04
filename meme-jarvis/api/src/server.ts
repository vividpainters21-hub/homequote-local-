import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocketPlugin from "@fastify/websocket";
import { fomoRoutes } from "./routes/fomo.js";
import { tokenRoutes } from "./routes/tokens.js";
import { traderRoutes } from "./routes/traders.js";
import { clusterRoutes } from "./routes/clusters.js";
import { alertRoutes } from "./routes/alerts.js";
import { paperRoutes } from "./routes/paper.js";
import { marketRoutes } from "./routes/market.js";
import { startPipelineLoop } from "./pipeline.js";

declare module "fastify" {
  interface FastifyInstance {
    wsBroadcast?: (message: unknown) => void;
  }
}

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocketPlugin);

  const sockets = new Set<import("ws").WebSocket>();
  app.decorate("wsBroadcast", (message: unknown) => {
    const payload = JSON.stringify(message);
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  });

  app.get("/ws", { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.send(JSON.stringify({ type: "connected", at: new Date().toISOString() }));
    socket.on("close", () => sockets.delete(socket));
  });

  app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));

  await app.register(fomoRoutes);
  await app.register(tokenRoutes);
  await app.register(traderRoutes);
  await app.register(clusterRoutes);
  await app.register(alertRoutes);
  await app.register(paperRoutes);
  await app.register(marketRoutes);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Meme Jarvis API listening on :${PORT}`);

  if (process.env.PIPELINE_ENABLED !== "false") {
    startPipelineLoop(undefined, (result) => app.wsBroadcast?.({ type: "pipeline-tick", ...result, at: new Date().toISOString() }));
    app.log.info("Pipeline loop started.");
  } else {
    app.log.warn("Pipeline loop disabled via PIPELINE_ENABLED=false.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
