// Auth Service - 處理認證相關的業務邏輯
import { Context } from "hono";
import { getCookie, deleteCookie } from "hono/cookie";
import { SessionService } from "./SessionService";
import { OidcService } from "./OidcService";
import { UserModel } from "../models/User";
import { getBaseUrl, getEnv } from "../utils";

export const STATE_COOKIE_NAME = "oidc_state";

export class AuthService {
  // 處理 OIDC 回調
  static async handleCallback(c: Context): Promise<Response> {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const storedState = getCookie(c, STATE_COOKIE_NAME);

    // 驗證 state
    if (!state || !storedState || state !== storedState) {
      return c.json({ error: "Invalid state parameter" }, 400);
    }

    // 清除 state cookie
    deleteCookie(c, STATE_COOKIE_NAME);

    if (!code) {
      return c.json({ error: "Authorization code not provided" }, 400);
    }

    try {
      // 根據請求 URL 動態生成 redirect URI（必須與授權請求時完全一致）
      const baseUrl = getBaseUrl(c);
      const redirectUri = OidcService.getRedirectUri(baseUrl, getEnv(c));
      const config = await OidcService.getConfiguration(getEnv(c), redirectUri);

      const serverMeta = config.serverMetadata();

      // 驗證 Client Secret 格式
      const env = getEnv(c);
      const clientSecret = env.OIDC_CLIENT_SECRET;
      if (!clientSecret) {
        throw new Error("OIDC_CLIENT_SECRET is not configured.");
      }

      // =================================================================
      // WARNING: Insecure workaround for a non-compliant OIDC server.
      // This code manually fetches the token and decodes the id_token
      // without proper validation. DO NOT USE IN PRODUCTION.
      // The OIDC server MUST be fixed to return a compliant response
      // including a full id_token.
      // =================================================================

      const tokenUrl = serverMeta.token_endpoint as string;
      const oidcConfig = OidcService.getConfig(getEnv(c));
      const plainCredentials = `${oidcConfig.clientId}:${clientSecret}`;
      const encodedCredentials = btoa(plainCredentials);

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encodedCredentials}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("Token endpoint returned an error:", tokenResponse.status, errorBody);
        const body = JSON.stringify({
          error: "Failed to fetch token",
          details: errorBody,
        });
        return new Response(body, {
          status: tokenResponse.status,
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
          },
        });
      }

      const tokenSet: { id_token?: string } = await tokenResponse.json();

      if (!tokenSet.id_token) {
        return c.json({ error: "ID token not provided in manual fetch" }, 400);
      }

      // Manually (and insecurely) decode the ID token payload.
      // This skips signature validation, which is a major security risk.
      let userInfo: { sub?: string; email?: string; name?: string } = {};
      try {
        const parts = tokenSet.id_token.split(".");
        if (parts.length >= 2) {
          const payload = parts[1];
          const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

          // Use a robust method to decode UTF-8 characters from Base64.
          // 1. Decode Base64 to a binary string.
          const binaryString = atob(base64);
          // 2. Convert the binary string to a Uint8Array.
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // 3. Decode the Uint8Array as a UTF-8 string.
          const decoded = new TextDecoder("utf-8").decode(bytes);

          // 定義 ID token claims 的類型
          interface IdTokenClaims {
            sub?: string;
            email?: string;
            name?: string;
          }

          const claims = JSON.parse(decoded) as IdTokenClaims;
          userInfo = {
            sub: claims.sub || claims.email, // Fallback to email if sub is missing
            email: claims.email,
            name: claims.name,
          };
        }
      } catch (e) {
        console.error("Failed to decode ID token:", e);
        return c.json({ error: "Failed to decode ID token" }, 500);
      }

      // 確保使用者資料存在於資料庫中
      if (userInfo.email) {
        try {
          let user = await UserModel.findByEmail(c, userInfo.email);

          // 如果使用者不存在，創建新使用者
          if (!user) {
            user = await UserModel.create(c, {
              user_id: userInfo.sub || crypto.randomUUID(),
              email: userInfo.email,
              name: userInfo.name,
            });
            console.log("Created new user:", user.user_id);
          }
        } catch (dbError) {
          console.error("Error ensuring user exists in database:", dbError);
          // 即使資料庫操作失敗，仍然創建 session（降級處理）
        }
      }

      // 創建 session
      await SessionService.create(c, {
        userId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        idToken: tokenSet.id_token,
      });

      return c.redirect("/");
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        code?: string;
        status?: number;
        error?: string;
        error_description?: string;
        cause?: unknown;
        response?: unknown;
      };
      console.error("OIDC callback error:", error);
      console.error("Error details:", {
        message: err.message,
        code: err.code,
        status: err.status,
        error: err.error,
        error_description: err.error_description,
        cause: err.cause,
      });

      // 嘗試從響應中獲取更多信息
      if (err.response) {
        console.error("Error response:", err.response);
      }

      // 打印完整的錯誤對象
      console.error(
        "Full error object:",
        JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)
      );

      // 如果是 401 錯誤，可能是 Client Secret 或 Redirect URI 問題
      if (err.status === 401) {
        return c.html(
          `
          <!DOCTYPE html>
          <html>
            <head>
              <title>認證失敗</title>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  max-width: 600px;
                  margin: 50px auto;
                  padding: 20px;
                }
                .error {
                  background: #fee;
                  border: 1px solid #fcc;
                  padding: 20px;
                  border-radius: 4px;
                }
                h1 { color: #c33; }
              </style>
            </head>
            <body>
              <div class="error">
                <h1>認證失敗 (401 Unauthorized)</h1>
                <p>可能的原因：</p>
                <ul>
                  <li>Client Secret 不正確</li>
                  <li>Redirect URI 不匹配（請確認 OIDC 服務器配置的 Redirect URI 為：${OidcService.getRedirectUri(
                    getBaseUrl(c),
                    getEnv(c)
                  )}）</li>
                  <li>Authorization code 已過期</li>
                </ul>
                <p><strong>錯誤訊息：</strong> ${err.error || err.message || "Unknown error"}</p>
                <p><a href="/login">重新登入</a></p>
              </div>
            </body>
          </html>
        `,
          401
        );
      }

      const statusCode = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return c.json(
        {
          error: "Authentication failed",
          details: err.error || err.message || String(error),
          status: statusCode,
        },
        statusCode as 400 | 401 | 403 | 404 | 500
      );
    }
  }
}
