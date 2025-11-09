// Auth Controller - 處理認證相關的請求
import { Context } from "hono";
import { AuthService } from "../services/AuthService";
import { SessionService } from "../services/SessionService";
import { OidcService } from "../services/OidcService";
import { getBaseUrl, setStateCookie, getEnv } from "../utils";

export class AuthController {
  // 登入 - 重定向到 OIDC 授權端點
  static async login(c: Context): Promise<Response> {
    const state = OidcService.generateState();
    setStateCookie(c, state);

    const baseUrl = getBaseUrl(c);
    const redirectUri = OidcService.getRedirectUri(baseUrl, getEnv(c));
    const config = await OidcService.getConfiguration(getEnv(c), redirectUri);
    const authUrl = OidcService.generateAuthUrl(config, state, redirectUri);

    return c.redirect(authUrl.toString());
  }

  // OIDC 回調處理
  static async callback(c: Context): Promise<Response> {
    return AuthService.handleCallback(c);
  }

  // 登出
  static async logout(c: Context): Promise<Response> {
    await SessionService.delete(c);
    return c.redirect("/login");
  }
}
