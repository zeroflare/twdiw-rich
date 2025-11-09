// 集中管理所有類型定義

// User 類型
export interface User {
  user_id: string;
  email: string;
  name?: string;
  created_at?: number;
  updated_at?: number;
}

// Asset 類型
export interface Asset {
  asset_id: string;
  user_id: string;
  asset_type: "CASH_AND_EQUIVALENTS" | "SECURITIES" | "REAL_ESTATE" | "VEHICLE";
  asset_name: string;
  current_value: number;
  location?: string;
  size_ping?: number;
  model_no?: string;
  model_year?: number;
  uuid?: string;
  certificate_type?: string;
  created_at?: number;
  updated_at?: number;
}

// Liability 類型
export interface Liability {
  liability_id: string;
  user_id: string;
  liability_type: "MORTGAGE" | "PERSONAL_LOAN" | "STUDENT_LOAN" | "CAR_LOAN" | "CREDIT_CARD_DEBT";
  liability_name: string;
  remaining_balance: number;
  uuid?: string;
  certificate_type?: string;
  created_at?: number;
  updated_at?: number;
}

// Rank Certificate 類型
export interface RankCertificate {
  rank_certificate_id: string;
  user_id: string;
  rank: string;
  net_worth: number;
  certificate_type?: string;
  created_at?: number;
  updated_at?: number;
}

// Income Certificate 類型
export interface IncomeCertificate {
  income_certificate_id: string;
  user_id: string;
  uuid: string;
  value: number;
  description: string;
  type: string;
  year: number;
  certificate_type?: string;
  created_at?: number;
  updated_at?: number;
}

// Session 類型
export interface Session {
  userId?: string;
  email?: string;
  name?: string;
  idToken?: string;
  expiresAt?: number;
}

// Net Worth Summary 類型
export interface NetWorthSummary {
  assets: number;
  liabilities: number;
  netWorth: number;
}

// OIDC 環境變數介面
export interface OidcEnv {
  OIDC_CLIENT_SECRET?: string;
  OIDC_WELL_KNOWN_URL?: string;
  OIDC_AUTH_URL?: string;
  OIDC_TOKEN_URL?: string;
  OIDC_JWKS_URL?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_REDIRECT_URI?: string;
}

// Wallet API 環境變數介面
export interface WalletApiEnv {
  WALLET_API_BASE_URL?: string;
  WALLET_API_ACCESS_TOKEN?: string;
}

// Issuer API 環境變數介面
export interface IssuerApiEnv {
  ISSUER_API_BASE_URL?: string;
  ISSUER_API_ACCESS_TOKEN?: string;
}

// 擴展 CloudflareBindings 類型
// 注意：不直接擴展 CloudflareBindings，因為 ASSETS 在 CloudflareBindings 中可能是必需的
export interface EnvWithStorage {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS?: Fetcher;
}

export type EnvWithOidc = EnvWithStorage & OidcEnv & WalletApiEnv & IssuerApiEnv;

// 應用程式綁定類型（用於 Hono 實例）
export type AppBindings = EnvWithStorage;

// Certificate Controller 請求體類型
export interface GenerateCertificateQRCodeRequest {
  certificateType: string;
}

export interface PollCertificateResultRequest {
  transactionId: string;
}

export interface CertificateField {
  ename: string;
  content: string;
}

export interface GenerateIssuerQRCodeRequest {
  vcUid: string;
  fields: CertificateField[];
  issuanceDate?: string;
  expiredDate?: string;
}
