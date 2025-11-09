// Certificate Controller - 處理憑證相關的請求
import { Context } from "hono";
import { CertificateService } from "../services/CertificateService";
import type {
  GenerateCertificateQRCodeRequest,
  PollCertificateResultRequest,
  GenerateIssuerQRCodeRequest,
} from "../types";

export class CertificateController {
  // 生成憑證登記 QR Code
  static async generateCertificateQRCode(c: Context): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const body = (await c.req.json()) as unknown as GenerateCertificateQRCodeRequest;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const certificateType: string = body.certificateType;

      if (!certificateType) {
        return c.json({ error: "Certificate type is required" }, 400);
      }

      const result = await CertificateService.generateCertificateQRCode(c, certificateType);

      return c.json(result);
    } catch (error) {
      console.error("Error generating certificate QR code:", error);
      const message = error instanceof Error ? error.message : "Failed to generate QR code";
      return c.json({ error: message }, 500);
    }
  }

  // 輪詢憑證登記結果
  static async pollCertificateResult(c: Context): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const body = (await c.req.json()) as unknown as PollCertificateResultRequest;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const transactionId: string = body.transactionId;

      if (!transactionId) {
        return c.json({ error: "Transaction ID is required" }, 400);
      }

      const result = await CertificateService.pollCertificateResult(c, transactionId);

      return c.json(result);
    } catch (error) {
      console.error("Error polling certificate result:", error);
      const message = error instanceof Error ? error.message : "Failed to poll result";
      return c.json({ error: message }, 500);
    }
  }

  // 生成憑證發行 QR Code
  static async generateIssuerQRCode(c: Context): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const body = (await c.req.json()) as unknown as GenerateIssuerQRCodeRequest;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const vcUid: string = body.vcUid;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const fields: Array<{ ename: string; content: string }> = body.fields;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const issuanceDate: string | undefined = body.issuanceDate;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const expiredDate: string | undefined = body.expiredDate;

      if (!vcUid || !fields) {
        return c.json({ error: "vcUid and fields are required" }, 400);
      }

      const result = await CertificateService.generateIssuerQRCode(
        c,
        vcUid,
        fields,
        issuanceDate,
        expiredDate
      );

      return c.json(result);
    } catch (error) {
      console.error("Error generating issuer QR code:", error);
      // 檢查是否有詳細的錯誤訊息
      if (error && typeof error === "object" && "error" in error) {
        return c.json({ error: (error as any).error }, 500);
      }
      const message = error instanceof Error ? error.message : "Failed to generate QR code";
      return c.json({ error: message }, 500);
    }
  }

  // 查詢憑證
  static async queryCredential(c: Context): Promise<Response> {
    try {
      const transactionId = c.req.param("transactionId");
      if (!transactionId) {
        return c.json({ error: "Transaction ID is required" }, 400);
      }

      const result = await CertificateService.queryCredential(c, transactionId);

      return c.json(result);
    } catch (error) {
      console.error("Error querying credential:", error);
      const message = error instanceof Error ? error.message : "Failed to query credential";
      return c.json({ error: message }, 500);
    }
  }

  // 撤銷憑證
  static async revokeCredential(c: Context): Promise<Response> {
    try {
      const cid = c.req.param("cid");
      if (!cid) {
        return c.json({ error: "CID is required" }, 400);
      }

      const result = await CertificateService.revokeCredential(c, cid);
      return c.json(result);
    } catch (error) {
      console.error("Error revoking credential:", error);
      const message = error instanceof Error ? error.message : "Failed to revoke credential";
      return c.json({ error: message }, 500);
    }
  }
}
