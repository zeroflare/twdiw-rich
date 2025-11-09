// 時間常量（毫秒）
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 小時
export const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 分鐘

// Cookie 配置
export const COOKIE_CONFIG = {
  httpOnly: true,
  sameSite: "Lax" as const,
} as const;

// CORS 配置
export const CORS_CONFIG = {
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] as string[],
  allowHeaders: ["Content-Type", "Authorization"] as string[],
};
