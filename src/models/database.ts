// 資料庫工具函數
import { Context } from "hono";
import { getEnv } from "../utils";

// 獲取 D1 資料庫實例
export function getDB(c: Context): D1Database {
  const env = getEnv(c);
  if (!env.DB) {
    throw new Error("D1 database binding not found");
  }
  return env.DB;
}
