// OIDC Service - 處理 OIDC 相關的業務邏輯
import * as oidc from "openid-client";
import { OidcEnv } from "../types";

// OIDC 配置介面
interface OidcConfig {
  wellKnownUrl: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  clientId: string;
  redirectUri: string;
}

export class OidcService {
  // 從環境變數獲取 OIDC 配置
  static getConfig(env?: OidcEnv): OidcConfig {
    const wellKnownUrl = env?.OIDC_WELL_KNOWN_URL;
    const authUrl = env?.OIDC_AUTH_URL;
    const tokenUrl = env?.OIDC_TOKEN_URL;
    const jwksUrl = env?.OIDC_JWKS_URL;
    const clientId = env?.OIDC_CLIENT_ID;
    const redirectUri = env?.OIDC_REDIRECT_URI;

    if (!wellKnownUrl || !authUrl || !tokenUrl || !jwksUrl || !clientId || !redirectUri) {
      throw new Error("Missing required OIDC environment variables. Please check your .env file.");
    }

    return {
      wellKnownUrl,
      authUrl,
      tokenUrl,
      jwksUrl,
      clientId,
      redirectUri,
    };
  }

  // 獲取 OIDC Configuration
  static async getConfiguration(env?: OidcEnv, redirectUri?: string): Promise<oidc.Configuration> {
    // 在 Cloudflare Workers 中，每次請求都應該重新初始化 configuration
    // 因為環境變數可能在不同請求間變化
    const oidcConfig = this.getConfig(env);
    const serverUrl = new URL(oidcConfig.wellKnownUrl);
    const finalRedirectUri = redirectUri || oidcConfig.redirectUri;
    const clientSecret = env?.OIDC_CLIENT_SECRET;

    if (!clientSecret) {
      throw new Error("OIDC_CLIENT_SECRET is not configured.");
    }

    const config = await oidc.discovery(
      serverUrl,
      oidcConfig.clientId,
      {
        redirect_uris: [finalRedirectUri],
        response_types: ["code"],
      },
      oidc.ClientSecretBasic(clientSecret) // 服務器要求使用 client_secret_basic
    );

    return config;
  }

  // 生成授權 URL
  static generateAuthUrl(config: oidc.Configuration, state: string, redirectUri: string): URL {
    return oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state: state,
    });
  }

  // 生成隨機 state
  static generateState(): string {
    return crypto.randomUUID();
  }

  // 獲取 redirect URI（根據請求 URL 動態生成）
  static getRedirectUri(baseUrl?: string, env?: OidcEnv): string {
    if (baseUrl) {
      return `${baseUrl}/redirect`;
    }
    const oidcConfig = this.getConfig(env);
    return oidcConfig.redirectUri;
  }
}
