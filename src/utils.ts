import { Context } from "hono";
import { setCookie } from "hono/cookie";
import { EnvWithOidc } from "./types";
import { COOKIE_CONFIG, STATE_EXPIRY_MS, SESSION_EXPIRY_MS } from "./constants";

// 獲取請求的 base URL
export function getBaseUrl(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

// 判斷是否為 HTTPS
export function isSecure(c: Context): boolean {
  const url = new URL(c.req.url);
  return url.protocol === "https:";
}

// 設置 Cookie 的輔助函數
export function setSecureCookie(c: Context, name: string, value: string, maxAge: number): void {
  setCookie(c, name, value, {
    ...COOKIE_CONFIG,
    secure: isSecure(c),
    maxAge,
  });
}

// 設置 State Cookie
export function setStateCookie(c: Context, state: string): void {
  setSecureCookie(c, "oidc_state", state, STATE_EXPIRY_MS / 1000);
}

// 設置 Session Cookie
export function setSessionCookie(c: Context, sessionId: string): void {
  setSecureCookie(c, "session_id", sessionId, SESSION_EXPIRY_MS / 1000);
}

// 安全地獲取環境變數
export function getEnv(c: Context): EnvWithOidc {
  return c.env as EnvWithOidc;
}
