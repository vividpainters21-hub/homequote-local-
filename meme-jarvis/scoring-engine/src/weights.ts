import { prisma } from "@meme-jarvis/database";
import { DEFAULT_OPPORTUNITY_WEIGHTS, type OpportunityWeights } from "@meme-jarvis/shared";

const DEFAULT_CONFIG_NAME = "default";

/** Loads the currently active weight set, seeding the default on first run. */
export async function getActiveWeights(): Promise<OpportunityWeights> {
  const active = await prisma.scoringConfig.findFirst({ where: { isActive: true } });
  if (active) return active.weights as unknown as OpportunityWeights;

  await prisma.scoringConfig.upsert({
    where: { name: DEFAULT_CONFIG_NAME },
    create: { name: DEFAULT_CONFIG_NAME, weights: DEFAULT_OPPORTUNITY_WEIGHTS as unknown as object, isActive: true },
    update: { isActive: true },
  });
  return DEFAULT_OPPORTUNITY_WEIGHTS;
}

/** Saves a new named weight configuration (for backtesting alternates). Does not activate it. */
export async function saveWeightConfig(name: string, weights: OpportunityWeights): Promise<void> {
  await prisma.scoringConfig.upsert({
    where: { name },
    create: { name, weights: weights as unknown as object, isActive: false },
    update: { weights: weights as unknown as object },
  });
}

/** Activates a previously saved weight configuration by name (deactivates all others). */
export async function activateWeightConfig(name: string): Promise<void> {
  await prisma.$transaction([
    prisma.scoringConfig.updateMany({ data: { isActive: false }, where: {} }),
    prisma.scoringConfig.update({ where: { name }, data: { isActive: true } }),
  ]);
}

export async function listWeightConfigs() {
  return prisma.scoringConfig.findMany({ orderBy: { createdAt: "desc" } });
}
