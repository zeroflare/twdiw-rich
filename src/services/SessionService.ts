// Session Service - 處理 Session 相關的業務邏輯
import { Context } from "hono";
import { getCookie, deleteCookie } from "hono/cookie";
import { Session } from "../types";
import { SESSION_EXPIRY_MS } from "../constants";
import { setSessionCookie, getEnv } from "../utils";

const SESSION_COOKIE_NAME = "session_id";

// 獲取 KV namespace
function getKV(c: Context): KVNamespace {
  const env = getEnv(c);
  if (!env.SESSIONS) {
    throw new Error("KV namespace SESSIONS not found");
  }
  return env.SESSIONS;
}

// 生成 session ID
function generateSessionId(): string {
  return crypto.randomUUID();
}

export class SessionService {
  // 獲取 session
  static async get(c: Context): Promise<Session | null> {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (!sessionId) {
      return null;
    }

    try {
      const kv = getKV(c);
      const sessionData = await kv.get(`session:${sessionId}`, "json");

      if (!sessionData) {
        return null;
      }

      const session = sessionData as Session;

      // 檢查是否過期
      if (session.expiresAt && session.expiresAt < Date.now()) {
        await kv.delete(`session:${sessionId}`);
        deleteCookie(c, SESSION_COOKIE_NAME);
        return null;
      }

      return session;
    } catch (error) {
      console.error("Error getting session from KV:", error);
      return null;
    }
  }

  // 創建 session
  static async create(c: Context, data: Session): Promise<string> {
    const sessionId = generateSessionId();
    const session: Session = {
      ...data,
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };

    try {
      const kv = getKV(c);
      // 計算 TTL（秒），最多 7 天
      const ttl = Math.floor(SESSION_EXPIRY_MS / 1000);
      await kv.put(`session:${sessionId}`, JSON.stringify(session), {
        expirationTtl: Math.min(ttl, 7 * 24 * 60 * 60), // 最多 7 天
      });

      setSessionCookie(c, sessionId);
      return sessionId;
    } catch (error) {
      console.error("Error creating session in KV:", error);
      throw error;
    }
  }

  // 刪除 session
  static async delete(c: Context): Promise<void> {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (sessionId) {
      try {
        const kv = getKV(c);
        await kv.delete(`session:${sessionId}`);
      } catch (error) {
        console.error("Error deleting session from KV:", error);
      }
      deleteCookie(c, SESSION_COOKIE_NAME);
    }
  }

  // 檢查是否已登入
  static async isAuthenticated(c: Context): Promise<boolean> {
    const session = await this.get(c);
    return session !== null;
  }
}
