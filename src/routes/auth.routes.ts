// Auth Routes - 認證相關路由
import { Hono } from "hono";
import { AuthController } from "../controllers/AuthController";
import { AppBindings } from "../types";

export function setupAuthRoutes(app: Hono<{ Bindings: AppBindings }>) {
  // 登入路由
  app.get("/login", (c) => AuthController.login(c));

  // OIDC 回調路由
  app.get("/redirect", (c) => AuthController.callback(c));

  // 登出路由
  app.get("/logout", (c) => AuthController.logout(c));
}
