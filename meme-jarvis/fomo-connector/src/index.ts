export * from "./types.js";
export * from "./fieldMap.js";
export * from "./heuristicConnector.js";

import type { FomoConnector } from "./types.js";
import { HeuristicFomoConnector } from "./heuristicConnector.js";

/** Active connector. Swap this to a future official-API implementation without touching callers. */
export function getActiveFomoConnector(): FomoConnector {
  return new HeuristicFomoConnector();
}
