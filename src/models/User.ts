// User Model - 處理使用者相關的資料庫操作
import { Context } from "hono";
import { User } from "../types";
import { getDB } from "./database";

export class UserModel {
  // 創建使用者（如果已存在則返回現有用戶）
  static async create(c: Context, user: Omit<User, "created_at" | "updated_at">): Promise<User> {
    const db = getDB(c);
    const userId = user.user_id || crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // 先檢查用戶是否已存在
    const existing = await this.findById(c, userId);
    if (existing) {
      console.log("User already exists:", userId);
      return existing;
    }

    // 檢查 email 是否已存在
    if (user.email) {
      const existingByEmail = await this.findByEmail(c, user.email);
      if (existingByEmail) {
        console.log("User with email already exists:", user.email);
        return existingByEmail;
      }
    }

    const result = await db
      .prepare(
        `INSERT INTO users (user_id, email, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, user.email, user.name || null, now, now)
      .run();

    if (!result.success) {
      const errorMessage = `Failed to create user: ${JSON.stringify(result.meta || {})}`;
      console.error("UserModel.create - Database operation failed:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("UserModel.create - Successfully created user:", userId);

    return {
      ...user,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };
  }

  // 根據 ID 獲取使用者
  static async findById(c: Context, userId: string): Promise<User | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM users WHERE user_id = ?")
      .bind(userId)
      .first<User>();

    return result || null;
  }

  // 根據 Email 獲取使用者
  static async findByEmail(c: Context, email: string): Promise<User | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first<User>();

    return result || null;
  }
}
