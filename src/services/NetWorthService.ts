// Net Worth Service - 處理淨值計算相關的業務邏輯
import { Context } from "hono";
import { NetWorthSummary } from "../types";
import { AssetModel } from "../models/Asset";
import { LiabilityModel } from "../models/Liability";

export class NetWorthService {
  // 計算淨值摘要
  static async getSummary(c: Context, userId: string): Promise<NetWorthSummary> {
    const assets = await AssetModel.getTotalByUserId(c, userId);
    const liabilities = await LiabilityModel.getTotalByUserId(c, userId);
    const netWorth = assets - liabilities;

    return {
      assets,
      liabilities,
      netWorth,
    };
  }

  // 計算 PR 值（台灣家庭淨資產百分位）
  static calculatePRValue(netWorth: number): number {
    // 轉換為新台幣萬元
    const netWorthInNTDMillions = netWorth / 1000;

    // 台灣家庭淨資產分佈的數據點（資產門檻：新台幣萬元）
    const dataPoints: Array<[number, number]> = [
      [0, 0], // 假設最低點
      [10, 143], // 第 1 十分位數 (D1)
      [25, 400], // 約第 1 四分位數 (Q1)
      [50, 894], // 中位數 (D5)
      [75, 1800], // 約第 3 四分位數 (Q3)
      [90, 3391], // 第 9 十分位數 (D9)
      [97.5, 5000], // 參考高資產客群門檻
      [100, 100000], // 設置一個極高點 (10億元) 以處理高資產輸入
    ];

    if (netWorthInNTDMillions <= dataPoints[0][1]) {
      return 0; // 低於最低點
    }

    if (netWorthInNTDMillions >= dataPoints[dataPoints.length - 1][1]) {
      return 100; // 高於最高點
    }

    // 進行線性插值 (Linear Interpolation)
    for (let i = 1; i < dataPoints.length; i++) {
      const [pr1, nw1] = dataPoints[i - 1];
      const [pr2, nw2] = dataPoints[i];

      if (netWorthInNTDMillions >= nw1 && netWorthInNTDMillions < nw2) {
        // 公式: PR = PR1 + (NW - NW1) * (PR2 - PR1) / (NW2 - NW1)
        const pr = pr1 + ((netWorthInNTDMillions - nw1) * (pr2 - pr1)) / (nw2 - nw1);
        return parseFloat(pr.toFixed(2)); // 取兩位小數
      }
    }

    return 100; // 備用保護
  }
}
