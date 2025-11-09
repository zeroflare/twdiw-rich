// Certificate Service - 處理憑證登記和發行的業務邏輯
import { Context } from "hono";
import { AssetModel } from "../models/Asset";
import { LiabilityModel } from "../models/Liability";
import { getEnv } from "../utils";

// 憑證類型映射
const CERTIFICATE_TYPES = {
  "0052696330_vp_liquid_finance_certificate": "流動性金融憑證",
  "0052696330_vp_real_estate_asset_certificate": "不動產資產憑證",
  "0052696330_vp_personal_property_certificate": "動產憑證",
  "0052696330_vp_credit_liability_certificate": "信用與負債憑證",
  "0052696330_vp_income_certificate": "年收入憑證",
};

interface CertificateData {
  verifyResult?: boolean;
  resultDescription?: string;
  data?: Array<{
    vcUid?: string;
    refVC?: string;
    claims?: Array<{
      ename: string;
      cname?: string;
      value: string;
    }>;
  }>;
}

export class CertificateService {
  // 生成憑證登記 QR Code
  static async generateCertificateQRCode(
    c: Context,
    certificateType: string
  ): Promise<{ transactionId: string; qrcodeImage: string; authUri: string }> {
    if (!CERTIFICATE_TYPES[certificateType as keyof typeof CERTIFICATE_TYPES]) {
      throw new Error("Invalid certificate type");
    }

    const env = getEnv(c);
    
    if (!env.WALLET_API_BASE_URL) {
      throw new Error("WALLET_API_BASE_URL environment variable is not set");
    }
    if (!env.WALLET_API_ACCESS_TOKEN) {
      throw new Error("WALLET_API_ACCESS_TOKEN environment variable is not set");
    }

    const walletApiBaseUrl = env.WALLET_API_BASE_URL;
    const accessToken = env.WALLET_API_ACCESS_TOKEN;

    const transactionId = crypto.randomUUID();

    const response = await fetch(
      `${walletApiBaseUrl}/api/oidvp/qrcode?ref=${certificateType}&transactionId=${transactionId}`,
      {
        method: "GET",
        headers: {
          "Access-Token": accessToken,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to generate QR code");
    }

    const data = await response.json();
    return {
      transactionId,
      qrcodeImage: data.qrcodeImage,
      authUri: data.authUri,
    };
  }

  // 輪詢憑證登記結果
  static async pollCertificateResult(
    c: Context,
    transactionId: string
  ): Promise<CertificateData & { status?: string; message?: string; databaseSave?: any }> {
    console.log(`Polling certificate result for transactionId: ${transactionId}`);

    const env = getEnv(c);
    
    if (!env.WALLET_API_BASE_URL) {
      throw new Error("WALLET_API_BASE_URL environment variable is not set");
    }
    if (!env.WALLET_API_ACCESS_TOKEN) {
      throw new Error("WALLET_API_ACCESS_TOKEN environment variable is not set");
    }

    const walletApiBaseUrl = env.WALLET_API_BASE_URL;
    const accessToken = env.WALLET_API_ACCESS_TOKEN;

    const response = await fetch(`${walletApiBaseUrl}/api/oidvp/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": accessToken,
      },
      body: JSON.stringify({ transactionId }),
    });

    console.log(`Wallet API response status: ${response.status}`);

    if (response.status === 400) {
      // User hasn't uploaded data yet
      const errorText = await response.text();
      console.log(`Wallet API 400 response: ${errorText}`);
      return {
        status: "pending",
        message: "請掃描 QR Code 並上傳資料",
      } as any;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("Poll certificate result error:", response.status, errorData);
      throw new Error(errorData.message || `Failed to poll result (${response.status})`);
    }

    const result = await response.json();
    console.log("Poll certificate result success:", {
      transactionId,
      hasData: !!result.data,
      dataLength: result.data?.length,
      verifyResult: result.verifyResult,
      resultDescription: result.resultDescription,
    });

    // 檢查是否有資料
    if (!result.data || result.data.length === 0) {
      console.warn("No data in result, returning pending");
      return {
        status: "pending",
        message: "請掃描 QR Code 並上傳資料",
      } as any;
    }

    // 保存憑證資料到資料庫
    const saveResult = await this.saveCertificateToDatabase(c, result, result.data?.[0]?.refVC);

    console.log("Database save result:", saveResult);

    return {
      status: "completed",
      verifyResult: result.verifyResult,
      resultDescription: result.resultDescription,
      data: result.data,
      databaseSave: saveResult,
    };
  }

  // 保存憑證資料到資料庫
  static async saveCertificateToDatabase(
    c: Context,
    certificateData: CertificateData,
    certificateType?: string
  ): Promise<{ success: boolean; savedCount?: number; errors?: string[] }> {
    try {
      if (!certificateData.data || certificateData.data.length === 0) {
        return { success: false, savedCount: 0 };
      }

      const data = certificateData.data[0];
      if (!data.claims || data.claims.length === 0) {
        return { success: false, savedCount: 0 };
      }

      // 獲取當前使用者 ID
      const session = await import("../services/SessionService").then((m) =>
        m.SessionService.get(c)
      );
      if (!session?.userId) {
        throw new Error("User not authenticated");
      }

      const userId = session.userId;
      const userEmail = session.email || userId; // 如果 email 不存在，使用 userId
      const userName = session.name || null;

      // 確保用戶存在於資料庫中（解決外鍵約束問題）
      const { UserModel } = await import("../models/User");
      let user = await UserModel.findById(c, userId);
      if (!user) {
        // 如果用戶不存在，創建新用戶（UserModel.create 會處理重複情況）
        console.log("User not found in database, creating user:", { userId, userEmail, userName });
        user = await UserModel.create(c, {
          user_id: userId,
          email: userEmail,
          name: userName,
        });
        console.log("User ensured in database:", user.user_id);
      }

      const vcUid = data.vcUid || null;

      // 提取 claims 到 map（先提取以便推斷類型）
      const claimsMap: Record<string, string> = {};
      data.claims.forEach((claim) => {
        claimsMap[claim.ename] = claim.value;
      });

      const typeClaim = claimsMap["type"];

      // 如果 refVC 不存在，根據 type claim 推斷憑證類型
      let refVC = data.refVC || certificateType || null;
      if (!refVC && typeClaim) {
        // 根據 type claim 推斷 refVC
        if (typeClaim === "CASH_AND_EQUIVALENT" || typeClaim === "SECURITIES") {
          refVC = "0052696330_vp_liquid_finance_certificate";
        } else if (typeClaim === "REAL_ESTATE") {
          refVC = "0052696330_vp_real_estate_asset_certificate";
        } else if (typeClaim === "VEHICLE") {
          refVC = "0052696330_vp_personal_property_certificate";
        } else if (
          typeClaim === "MORTGAGE" ||
          typeClaim === "PERSONAL_LOAN" ||
          typeClaim === "STUDENT_LOAN" ||
          typeClaim === "CAR_LOAN" ||
          typeClaim === "CREDIT_CARD_DEBT"
        ) {
          refVC = "0052696330_vp_credit_liability_certificate";
        } else if (typeClaim === "ANNUAL_INCOME") {
          refVC = "0052696330_vp_income_certificate";
        }
      }

      console.log("Saving certificate to database:", {
        userId,
        vcUid,
        refVC,
        certificateType,
        typeClaim,
        hasClaims: !!data.claims,
        claimsCount: data.claims?.length,
      });

      // 映射憑證類型
      const certTypeMapping: Record<string, string> = {
        "0052696330_vp_liquid_finance_certificate": "liquid_finance",
        "0052696330_vp_real_estate_asset_certificate": "real_estate",
        "0052696330_vp_personal_property_certificate": "personal_property",
        "0052696330_vp_credit_liability_certificate": "credit_liability",
        "0052696330_vp_income_certificate": "income",
      };

      const certType = certTypeMapping[refVC || ""] || refVC;
      console.log("Certificate type mapping:", {
        refVC,
        certType,
        inferred: !data.refVC && !certificateType,
      });

      // 使用已經提取的 claimsMap
      const uuidClaim = claimsMap["uuid"];
      const descriptionClaim = claimsMap["description"];
      const valueClaim = claimsMap["value"];
      const yearClaim = claimsMap["year"];

      console.log("Extracted claims:", {
        typeClaim,
        uuidClaim,
        descriptionClaim,
        valueClaim,
        allClaims: claimsMap,
      });

      const itemUuid = uuidClaim || vcUid;
      const assetName = descriptionClaim || "未命名項目";
      const numericValue = parseFloat(valueClaim) || 0;

      console.log("Processed data:", {
        itemUuid,
        assetName,
        numericValue,
        certType,
      });

      let savedCount = 0;
      const errors: string[] = [];

      // 檢查資料庫連接
      try {
        const db = await import("../models/database").then((m) => m.getDB(c));
        console.log("Database connection check:", { hasDB: !!db });
      } catch (dbError) {
        console.error("Database connection error:", dbError);
        errors.push(`Database connection error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }

      try {
        // 處理流動性金融憑證
        if (certType === "liquid_finance") {
          // 注意：typeClaim 可能是 "CASH_AND_EQUIVALENT"（單數）或 "SECURITIES"
          const assetType = typeClaim === "SECURITIES" ? "SECURITIES" : "CASH_AND_EQUIVALENTS";

          console.log("Attempting to save liquid_finance asset:", {
            userId,
            assetType,
            assetName,
            numericValue,
            itemUuid,
            refVC,
          });

          // 刪除現有記錄（如果存在）
          if (itemUuid) {
            try {
              const existing = await AssetModel.findByUuid(c, itemUuid, userId);
              if (existing) {
                console.log("Found existing asset, deleting:", existing.asset_id);
                await AssetModel.delete(c, existing.asset_id, userId);
              }
            } catch (e) {
              console.warn("Error finding/deleting existing asset:", e);
              // 忽略查找錯誤，繼續創建新記錄
            }
          }

          const createdAsset = await AssetModel.create(c, {
            user_id: userId,
            asset_type: assetType,
            asset_name: assetName,
            current_value: numericValue,
            uuid: itemUuid || undefined,
            certificate_type: refVC || undefined,
          });
          savedCount++;
          console.log("Successfully saved liquid_finance asset:", {
            assetId: createdAsset.asset_id,
            assetType,
            assetName,
            numericValue,
          });
        }
        // 處理不動產憑證
        else if (certType === "real_estate") {
          const location = claimsMap["location"] || null;
          const sizePing = claimsMap["size_ping"] ? parseFloat(claimsMap["size_ping"]) : null;

          console.log("Attempting to save real_estate asset:", {
            userId,
            assetName,
            numericValue,
            location,
            sizePing,
            itemUuid,
            refVC,
          });

          if (itemUuid) {
            try {
              const existing = await AssetModel.findByUuid(c, itemUuid, userId);
              if (existing) {
                console.log("Found existing asset, deleting:", existing.asset_id);
                await AssetModel.delete(c, existing.asset_id, userId);
              }
            } catch (e) {
              console.warn("Error finding/deleting existing asset:", e);
              // 忽略查找錯誤，繼續創建新記錄
            }
          }

          const createdAsset = await AssetModel.create(c, {
            user_id: userId,
            asset_type: "REAL_ESTATE",
            asset_name: assetName,
            current_value: numericValue,
            location: location || undefined,
            size_ping: sizePing || undefined,
            uuid: itemUuid || undefined,
            certificate_type: refVC || undefined,
          });
          savedCount++;
          console.log("Successfully saved real_estate asset:", {
            assetId: createdAsset.asset_id,
            assetName,
            numericValue,
            location,
            sizePing,
          });
        }
        // 處理動產憑證（車輛）
        else if (certType === "personal_property") {
          const modelNo = claimsMap["model_no"] || null;
          const modelYear = claimsMap["model_year"] ? parseInt(claimsMap["model_year"]) : null;

          console.log("Attempting to save personal_property asset:", {
            userId,
            assetName,
            numericValue,
            modelNo,
            modelYear,
            itemUuid,
            refVC,
          });

          if (itemUuid) {
            try {
              const existing = await AssetModel.findByUuid(c, itemUuid, userId);
              if (existing) {
                console.log("Found existing asset, deleting:", existing.asset_id);
                await AssetModel.delete(c, existing.asset_id, userId);
              }
            } catch (e) {
              console.warn("Error finding/deleting existing asset:", e);
              // 忽略查找錯誤，繼續創建新記錄
            }
          }

          const createdAsset = await AssetModel.create(c, {
            user_id: userId,
            asset_type: "VEHICLE",
            asset_name: assetName,
            current_value: numericValue,
            model_no: modelNo || undefined,
            model_year: modelYear || undefined,
            uuid: itemUuid || undefined,
            certificate_type: refVC || undefined,
          });
          savedCount++;
          console.log("Successfully saved personal_property asset:", {
            assetId: createdAsset.asset_id,
            assetName,
            numericValue,
            modelNo,
            modelYear,
          });
        }
        // 處理信用與負債憑證
        else if (certType === "credit_liability") {
          const liabilityType = typeClaim || "PERSONAL_LOAN";

          if (itemUuid) {
            try {
              const existing = await LiabilityModel.findByUuid(c, itemUuid, userId);
              if (existing) {
                await LiabilityModel.delete(c, existing.liability_id, userId);
              }
            } catch (e) {
              // 忽略查找錯誤，繼續創建新記錄
            }
          }

          await LiabilityModel.create(c, {
            user_id: userId,
            liability_type: liabilityType as any,
            liability_name: assetName,
            remaining_balance: numericValue,
            uuid: itemUuid || undefined,
            certificate_type: refVC || undefined,
          });
          savedCount++;
          console.log("Saved credit_liability:", { liabilityType, assetName, numericValue });
        }
        // 處理年收入憑證
        else if (certType === "income") {
          const { IncomeCertificateModel } = await import("../models/IncomeCertificate");
          const yearValue = yearClaim ? parseInt(yearClaim, 10) : new Date().getFullYear();

          if (itemUuid) {
            try {
              const existing = await IncomeCertificateModel.findByUserId(c, userId);
              const existingCert = existing.find((cert) => cert.uuid === itemUuid);
              if (existingCert) {
                await IncomeCertificateModel.deleteById(c, existingCert.income_certificate_id);
              }
            } catch (e) {
              // 忽略查找錯誤，繼續創建新記錄
            }
          }

          await IncomeCertificateModel.create(c, {
            user_id: userId,
            uuid: itemUuid || vcUid,
            value: numericValue,
            description: descriptionClaim || "年收入",
            type: typeClaim || "ANNUAL_INCOME",
            year: yearValue,
            certificate_type: refVC || "0052696330_vc_income__certificate",
          });
          savedCount++;
          console.log("Saved income certificate:", { assetName, numericValue, yearValue });
        } else {
          console.warn("Unknown certificate type:", certType);
          errors.push(`Unknown certificate type: ${certType}`);
        }
      } catch (claimError: any) {
        console.error("Error saving claim:", claimError);
        console.error("Error details:", {
          message: claimError.message,
          stack: claimError.stack,
          name: claimError.name,
          cause: claimError.cause,
        });
        errors.push(claimError.message || String(claimError));
      }

      console.log("Save result:", {
        success: savedCount > 0,
        savedCount,
        errors: errors.length > 0 ? errors : undefined,
        userId,
      });

      if (savedCount === 0 && errors.length === 0) {
        console.warn("No items saved and no errors reported. This might indicate a problem.");
      }

      return {
        success: savedCount > 0,
        savedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error("Error saving certificate to database:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
      });
      return {
        success: false,
        errors: [error.message || String(error)],
      };
    }
  }

  // 生成憑證發行 QR Code
  static async generateIssuerQRCode(
    c: Context,
    vcUid: string,
    fields: Array<{ ename: string; content: string }>,
    issuanceDate?: string,
    expiredDate?: string
  ): Promise<{ transactionId: string; qrCode: string }> {
    const env = getEnv(c);
    
    if (!env.ISSUER_API_BASE_URL) {
      throw new Error("ISSUER_API_BASE_URL environment variable is not set");
    }
    if (!env.ISSUER_API_ACCESS_TOKEN) {
      throw new Error("ISSUER_API_ACCESS_TOKEN environment variable is not set");
    }

    const issuerApiBaseUrl = env.ISSUER_API_BASE_URL;
    const issuerAccessToken = env.ISSUER_API_ACCESS_TOKEN;

    const requestBody: any = {
      vcUid,
      fields,
    };

    if (issuanceDate) {
      requestBody.issuanceDate = issuanceDate;
    }
    if (expiredDate) {
      requestBody.expiredDate = expiredDate;
    }

    const response = await fetch(`${issuerApiBaseUrl}/api/qrcode/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": issuerAccessToken,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // 檢查是否有詳細的錯誤訊息（error 欄位）
      if (errorData.error) {
        const error = new Error("Failed to create QR code");
        (error as any).error = errorData.error;
        throw error;
      }
      throw new Error(errorData.message || "Failed to create QR code");
    }

    const data = await response.json();
    return {
      transactionId: data.transactionId,
      qrCode: data.qrCode,
    };
  }

  // 查詢憑證
  static async queryCredential(
    c: Context,
    transactionId: string
  ): Promise<{ cid?: string; credential?: string; credentialStatus?: string }> {
    const env = getEnv(c);
    
    if (!env.ISSUER_API_BASE_URL) {
      throw new Error("ISSUER_API_BASE_URL environment variable is not set");
    }
    if (!env.ISSUER_API_ACCESS_TOKEN) {
      throw new Error("ISSUER_API_ACCESS_TOKEN environment variable is not set");
    }

    const issuerApiBaseUrl = env.ISSUER_API_BASE_URL;
    const issuerAccessToken = env.ISSUER_API_ACCESS_TOKEN;

    const response = await fetch(`${issuerApiBaseUrl}/api/credential/nonce/${transactionId}`, {
      method: "GET",
      headers: {
        "Access-Token": issuerAccessToken,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to query credential");
    }

    const data = await response.json();

    // 解析 JWT 提取 CID
    let cid: string | undefined;
    if (data.credential) {
      try {
        const parts = data.credential.split(".");
        if (parts.length === 3) {
          // Cloudflare Workers 環境中使用 atob 解析 base64
          const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const payload = JSON.parse(new TextDecoder("utf-8").decode(bytes));
          if (payload.jti) {
            const match = payload.jti.match(/\/api\/credential\/([a-f0-9-]+)/);
            if (match) {
              cid = match[1];
            }
          }
        }
      } catch (parseError) {
        console.error("Error parsing JWT:", parseError);
      }
    }

    return {
      ...data,
      cid,
    };
  }

  // 撤銷憑證
  static async revokeCredential(c: Context, cid: string): Promise<{ credentialStatus: string }> {
    const env = getEnv(c);
    
    if (!env.ISSUER_API_BASE_URL) {
      throw new Error("ISSUER_API_BASE_URL environment variable is not set");
    }
    if (!env.ISSUER_API_ACCESS_TOKEN) {
      throw new Error("ISSUER_API_ACCESS_TOKEN environment variable is not set");
    }

    const issuerApiBaseUrl = env.ISSUER_API_BASE_URL;
    const issuerAccessToken = env.ISSUER_API_ACCESS_TOKEN;

    const response = await fetch(`${issuerApiBaseUrl}/api/credential/${cid}/revocation`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": issuerAccessToken,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to revoke credential");
    }

    return await response.json();
  }
}
