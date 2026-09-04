import { describe, expect, it } from "vitest";
import { detectClusters, findStrongestCluster } from "@meme-jarvis/cluster-engine";
import type { ClusterCandidate, TraderEntry } from "@meme-jarvis/shared";

function entry(overrides: Partial<TraderEntry> & { secondsAgo: number }): TraderEntry {
  return {
    walletAddress: `w-${Math.random()}`,
    traderScore: 80,
    winRate: 70,
    amountUsd: 500,
    side: "BUY",
    occurredAt: new Date(Date.now() - overrides.secondsAgo * 1000).toISOString(),
    ...overrides,
  };
}

describe("detectClusters", () => {
  it("does not trigger with only 2 strong buyers in 60 seconds", () => {
    const candidate: ClusterCandidate = {
      tokenMint: "mintA",
      entries: [entry({ secondsAgo: 50 }), entry({ secondsAgo: 20 })],
    };
    expect(detectClusters(candidate)).toHaveLength(0);
  });

  it("triggers the 60s/3-member tier with 3 strong buyers within 60 seconds", () => {
    const candidate: ClusterCandidate = {
      tokenMint: "mintA",
      entries: [entry({ secondsAgo: 55 }), entry({ secondsAgo: 40 }), entry({ secondsAgo: 10 })],
    };
    const clusters = detectClusters(candidate);
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters[0].memberCount).toBe(3);
    expect(clusters[0].windowSeconds).toBe(60);
  });

  it("counts a wallet only once even if it bought twice in the window", () => {
    const sharedWallet = "w-repeat";
    const candidate: ClusterCandidate = {
      tokenMint: "mintA",
      entries: [
        entry({ secondsAgo: 55, walletAddress: sharedWallet }),
        entry({ secondsAgo: 45, walletAddress: sharedWallet }),
        entry({ secondsAgo: 40 }),
        entry({ secondsAgo: 10 }),
      ],
    };
    const strongest = findStrongestCluster(candidate);
    expect(strongest?.memberCount).toBe(3); // 2 unique wallets from the repeat + 2 others, deduped
  });

  it("marks a member as exiting once they sell after their buy", () => {
    const wallet = "w-exit";
    const candidate: ClusterCandidate = {
      tokenMint: "mintA",
      entries: [
        entry({ secondsAgo: 55, walletAddress: wallet }),
        entry({ secondsAgo: 50 }),
        entry({ secondsAgo: 45 }),
        { walletAddress: wallet, traderScore: 80, winRate: 70, amountUsd: 500, side: "SELL", occurredAt: new Date().toISOString() },
      ],
    };
    const strongest = findStrongestCluster(candidate);
    expect(strongest?.exitingCount).toBe(1);
    expect(strongest?.stillHoldingCount).toBe(2);
  });
});
