// Auth Middleware - 認證中間件
import { Context } from "hono";
import { SessionService } from "../services/SessionService";
import { OidcService } from "../services/OidcService";
import { getBaseUrl, setStateCookie, getEnv } from "../utils";

// 需要認證的中間件
export async function requireAuth(c: Context, next: () => Promise<void>) {
  const authenticated = await SessionService.isAuthenticated(c);
  if (!authenticated) {
    const state = OidcService.generateState();
    setStateCookie(c, state);

    const baseUrl = getBaseUrl(c);
    const redirectUri = OidcService.getRedirectUri(baseUrl, getEnv(c));
    const config = await OidcService.getConfiguration(getEnv(c), redirectUri);
    const authUrl = OidcService.generateAuthUrl(config, state, redirectUri);

    return c.redirect(authUrl.toString());
  }
  await next();
}
