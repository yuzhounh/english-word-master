import { createHash, randomUUID } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { RequestHandler, Response } from "express";
import firebaseConfig from "../firebase-applet-config.json";

const MINUTE_MS = 60000;
const DAY_MS = 86400000;
// Longer than the AI route's 55s execution budget; crashed instances expire safely.
export const AI_LEASE_MS = 70000;

export class AiAccessError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function sendAiError(res: Response, error: unknown) {
  const failure = error instanceof AiAccessError ? error :
    new AiAccessError(503, "AI_UNAVAILABLE", "AI 服务暂不可用，请稍后重试。");
  if (failure.retryAfter) res.setHeader("Retry-After", String(failure.retryAfter));
  return res.status(failure.status).json({ success: false, code: failure.code, error: failure.message });
}

export interface Usage {
  day: number;
  calls: number;
  minute: number;
  requests: number;
  leases: { id: string; expiresAt: number }[];
}

export interface UsageStore {
  // Both documents must be read and changed in one atomic transaction.
  update(uid: string, change: (user?: Usage, global?: Usage) => [Usage, Usage]): Promise<void>;
}

export interface AiAccess {
  authenticate: RequestHandler;
  reserve(uid: string, calls: number): Promise<() => Promise<void>>;
}

function adminApp() {
  const existing = getApps().find(app => app.name === "paid-ai");
  if (existing) return existing;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    projectId: firebaseConfig.projectId,
    credential: credentials ? cert(JSON.parse(credentials)) : applicationDefault()
  }, "paid-ai");
}

const firestoreStore: UsageStore = {
  async update(uid, change) {
    const db = getFirestore(adminApp());
    // Keep counters outside /users, where clients can write their own documents.
    const user = db.doc(`aiUsage/user-${createHash("sha256").update(uid).digest("hex")}`);
    const global = db.doc("aiUsage/global");
    await db.runTransaction(async tx => {
      const snapshots = await tx.getAll(user, global);
      const [nextUser, nextGlobal] = change(
        snapshots[0].data() as Usage | undefined,
        snapshots[1].data() as Usage | undefined
      );
      tx.set(user, nextUser);
      tx.set(global, nextGlobal);
    });
  }
};

function quota(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function currentUsage(previous: Usage | undefined, now: number): Usage {
  const day = Math.floor(now / DAY_MS);
  const minute = Math.floor(now / MINUTE_MS);
  return {
    day,
    calls: previous?.day === day ? previous.calls : 0,
    minute,
    requests: previous?.minute === minute ? previous.requests : 0,
    leases: (previous?.leases || []).filter(lease => lease.expiresAt > now)
  };
}

export function createAiAccess(dependencies: {
  store?: UsageStore;
  verifyToken?: (token: string) => Promise<DecodedIdToken>;
  now?: () => number;
} = {}): AiAccess {
  const store = dependencies.store || firestoreStore;
  const verifyToken = dependencies.verifyToken || ((token: string) => getAuth(adminApp()).verifyIdToken(token, true));
  const now = dependencies.now || Date.now;

  return {
    authenticate: async (req, res, next) => {
      const bearer = req.header("Authorization")?.match(/^Bearer ([^\s]+)$/i);
      if (!bearer || bearer[1].length > 8192) {
        return void sendAiError(res, new AiAccessError(401, "AUTH_REQUIRED", "请先登录，再使用 AI 补全。"));
      }
      try {
        const token = await verifyToken(bearer[1]);
        if (!token.uid || token.firebase?.sign_in_provider === "anonymous") {
          throw new AiAccessError(403, "ACCOUNT_REQUIRED", "请使用正式账号登录后使用 AI。");
        }
        res.locals.aiUid = token.uid;
        next();
      } catch (error: any) {
        const invalidToken = ["auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired",
          "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found"].includes(error?.code);
        sendAiError(res, invalidToken ?
          new AiAccessError(401, "AUTH_INVALID", "登录已失效，请重新登录。") : error);
      }
    },
    async reserve(uid, calls) {
      const id = randomUUID();
      try {
        await store.update(uid, (previousUser, previousGlobal) => {
          const timestamp = now();
          const user = currentUsage(previousUser, timestamp);
          const global = currentUsage(previousGlobal, timestamp);
          const minuteRetry = Math.ceil((MINUTE_MS - timestamp % MINUTE_MS) / 1000);
          const dayRetry = Math.ceil((DAY_MS - timestamp % DAY_MS) / 1000);
          if (user.requests >= 10 || global.requests >= 60) {
            throw new AiAccessError(429, "RATE_LIMIT", "AI 请求过于频繁，请稍后重试。", minuteRetry);
          }
          if (user.calls + calls > quota("AI_USER_DAILY_CALLS", 50) ||
              global.calls + calls > quota("AI_GLOBAL_DAILY_CALLS", 1000)) {
            throw new AiAccessError(429, "QUOTA_EXCEEDED", "今日 AI 配额已用完，请明日重试。", dayRetry);
          }
          if (user.leases.length >= 1 || global.leases.length >= 2) {
            const leases = user.leases.length >= 1 ? user.leases : global.leases;
            const retry = Math.max(1, Math.ceil((Math.min(...leases.map(lease => lease.expiresAt)) - timestamp) / 1000));
            throw new AiAccessError(429, "CONCURRENCY_LIMIT", "AI 正在处理请求，请稍后重试。", retry);
          }
          const lease = { id, expiresAt: timestamp + AI_LEASE_MS };
          for (const usage of [user, global]) {
            usage.requests++;
            usage.calls += calls;
            usage.leases.push(lease);
          }
          return [user, global];
        });
      } catch (error) {
        if (error instanceof AiAccessError) throw error;
        console.error("AI quota reservation failed:", error);
        throw new AiAccessError(503, "AI_UNAVAILABLE", "AI 配额服务暂不可用，请稍后重试。");
      }
      // Reservations are not refunded: retries, timeouts and aborted requests cannot reset billing limits.
      return async () => {
        try {
          await store.update(uid, (user, global) => {
            if (!user || !global) throw new Error("AI usage documents are missing.");
            return [user, global].map(usage => ({
              ...usage, leases: usage.leases.filter(lease => lease.id !== id)
            })) as [Usage, Usage];
          });
        } catch (error) {
          console.error("AI lease release failed; lease will expire:", error);
        }
      };
    }
  };
}
