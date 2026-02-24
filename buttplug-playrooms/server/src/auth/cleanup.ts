import { cleanupExpiredShareLinks } from "./share-links.js";
import { cleanupExpiredChallengeCodes } from "./lobby.js";
import { cleanupInactiveGuests } from "./guest-profiles.js";
import { cleanupRateLimiterState } from "./rate-limiter.js";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let intervalId: ReturnType<typeof setInterval> | null = null;

function runCleanup(): void {
  try {
    const expiredLinks = cleanupExpiredShareLinks();
    const expiredCodes = cleanupExpiredChallengeCodes();
    const expiredGuests = cleanupInactiveGuests();
    cleanupRateLimiterState();

    if (expiredLinks > 0 || expiredCodes > 0 || expiredGuests > 0) {
      console.log(
        `[Cleanup] Removed: ${expiredLinks} expired share links, ` +
        `${expiredCodes} expired challenge codes, ` +
        `${expiredGuests} inactive guest profiles`
      );
    }
  } catch (err) {
    console.error("[Cleanup] Error during cleanup:", (err as Error).message);
  }
}

export function startCleanupInterval(): void {
  // Run once immediately on startup
  runCleanup();
  intervalId = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}

export function stopCleanupInterval(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
