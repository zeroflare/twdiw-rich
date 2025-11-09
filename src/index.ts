// 主入口文件 - 整合所有路由和配置
import { Hono, Context } from "hono";
import { cors } from "hono/cors";
import { CORS_CONFIG } from "./constants";
import { setupAuthRoutes } from "./routes/auth.routes";
import { setupApiRoutes } from "./routes/api.routes";
import { AppBindings } from "./types";

const app = new Hono<{ Bindings: AppBindings }>();

// CORS 中間件 - 用於 API 路由
app.use(
  "/api/*",
  cors({
    origin: "*", // 生產環境應該設置為具體的前端域名
    ...CORS_CONFIG,
  })
);

// 輔助函數：從 ASSETS binding 獲取靜態資源
async function getStaticAsset(
  c: Context<{ Bindings: AppBindings }>,
  path: string
): Promise<Response | null> {
  const assets: Fetcher | undefined = c.env?.ASSETS;
  if (!assets) {
    return null;
  }

  try {
    const url = new URL(path, c.req.url);
    const request = new Request(url.toString(), c.req.raw);
    const response: Response = await assets.fetch(request);

    if (response && response.status !== 404) {
      return response;
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Failed to fetch ${path} from ASSETS:`, error);
  }

  return null;
}

// 淨資產儀表板 - 返回 index.html（前端會處理認證）
app.get("/", async (c) => {
  const response = await getStaticAsset(c, "/index.html");
  return response || c.notFound();
});

// 設置認證路由
setupAuthRoutes(app);

// 設置 API 路由
setupApiRoutes(app);

// 處理靜態資源：在所有路由之後，如果沒有匹配的路由，嘗試從 ASSETS binding 獲取
app.get("*", async (c) => {
  const response = await getStaticAsset(c, c.req.path);
  return response || c.notFound();
});

export default app;
