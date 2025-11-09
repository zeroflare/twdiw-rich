// API Routes - API 相關路由
import { Hono } from "hono";
import { UserController } from "../controllers/UserController";
import { AssetController } from "../controllers/AssetController";
import { LiabilityController } from "../controllers/LiabilityController";
import { NetWorthController } from "../controllers/NetWorthController";
import { CertificateController } from "../controllers/CertificateController";
import { RankCertificateController } from "../controllers/RankCertificateController";
import { IncomeCertificateController } from "../controllers/IncomeCertificateController";
import { requireAuth } from "../middleware/auth.middleware";
import { AppBindings } from "../types";
import { AiController } from "../controllers/AiController";

export function setupApiRoutes(app: Hono<{ Bindings: AppBindings }>) {
  // API - 獲取使用者資訊（包含設定，需要認證）
  app.get("/api/user", requireAuth, (c) => UserController.getCurrentUser(c));
  
  // API - 更新使用者設定（需要認證）
  app.put("/api/user/settings", requireAuth, (c) => UserController.updateSettings(c));

  // 資產相關 API（需要認證）
  app.get("/api/assets", requireAuth, (c) => AssetController.getAll(c));
  app.put("/api/assets/:id", requireAuth, (c) => AssetController.update(c));
  app.delete("/api/assets/:id", requireAuth, (c) => AssetController.delete(c));

  // 負債相關 API（需要認證）
  app.get("/api/liabilities", requireAuth, (c) => LiabilityController.getAll(c));
  app.delete("/api/liabilities/:id", requireAuth, (c) => LiabilityController.delete(c));

  // 淨值相關 API（需要認證）
  app.get("/api/net-worth-summary", requireAuth, (c) => NetWorthController.getSummary(c));

  // 憑證登記相關 API（需要認證）
  app.post("/api/generate-certificate-qrcode", requireAuth, (c) =>
    CertificateController.generateCertificateQRCode(c)
  );
  app.post("/api/poll-certificate-result", requireAuth, (c) =>
    CertificateController.pollCertificateResult(c)
  );

  // 憑證發行相關 API（需要認證）
  app.post("/api/issuer/create-qrcode", requireAuth, (c) =>
    CertificateController.generateIssuerQRCode(c)
  );
  app.get("/api/issuer/query-credential/:transactionId", requireAuth, (c) =>
    CertificateController.queryCredential(c)
  );
  app.put("/api/issuer/revoke-credential/:cid", requireAuth, (c) =>
    CertificateController.revokeCredential(c)
  );

  // 財富階層憑證相關 API（需要認證）
  app.post("/api/claim-rank-certificate", requireAuth, (c) => RankCertificateController.claim(c));
  app.get("/api/rank-certificate", requireAuth, (c) => RankCertificateController.get(c));
  app.post("/api/rank-certificate/generate-qrcode", requireAuth, (c) =>
    RankCertificateController.generateIssuerQRCode(c)
  );

  // 年收入憑證相關 API（需要認證）
  app.get("/api/income-certificates", requireAuth, (c) => IncomeCertificateController.getAll(c));
  app.delete("/api/income-certificates/:id", requireAuth, (c) => IncomeCertificateController.delete(c));

  // AI
  app.post("/api/analyze-asset-value", requireAuth, (c) =>
    AiController.analyzeAssetValue(c)
  );

  // 測試路由（不需要認證）
  app.get("/message", (c) => {
    return c.text("Hello Hono!");
  });
}
