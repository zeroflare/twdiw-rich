import { GoogleGenerativeAI } from "@google/generative-ai";

interface RealEstateDetails {
  location: string;
  size_ping: number;
}

interface VehicleDetails {
  model_no: string;
  model_year: number;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async getAssetValuation(
    assetName: string,
    assetType: string,
    assetDetails: unknown
  ): Promise<number> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
    });

    const prompt = this.createValuationPrompt(assetName, assetType, assetDetails);

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      console.log("Gemini raw response:", text);
      return this.parseValuationResponse(text);
    } catch (error) {
      console.error("Error getting asset valuation from Gemini:", error);
      throw new Error("AI aalysis failed.");
    }
  }

  private createValuationPrompt(assetName: string, assetType: string, assetDetails: unknown): string {
    // --- 1. 建立資產詳細資訊區塊 ---
    // 無論是哪種資產，都先提供基本資訊
    let detailsBlock = `資產名稱: ${assetName}\n`;
    detailsBlock += `資產類型: ${assetType}\n`;

    // 根據不同的 assetType 附加專屬資訊
    switch (assetType) {
      case "REAL_ESTATE":
        if (assetDetails) {
          const details = assetDetails as RealEstateDetails;
          detailsBlock += `地址: ${details.location}\n`;
          detailsBlock += `坪數: ${details.size_ping} 坪\n`;
        }
        break;

      case "VEHICLE":
        if (assetDetails) {
          const details = assetDetails as VehicleDetails;
          detailsBlock += `型號: ${details.model_no}\n`;
          detailsBlock += `年份: ${details.model_year}\n`;
          detailsBlock += `請考慮目前時間與二手車折舊率，常用的估價方式為 (新車價 * 0.8) - (新車價 * 5% * 年齡)`;
        }
        break;

      default:
        // 如果是未知的資產類型，提供一個通用的回報方式
        if (assetDetails) {
          detailsBlock += `其他詳細資訊: ${JSON.stringify(assetDetails)}\n`;
        }
        break;
    }

    // --- 2. 組合最終的 Prompt ---
    // 使用模板字串 (template literal) 來建構，更清晰易讀
    const prompt = `
        請根據以下資產資訊，評估其當前的市場價值(TWD)。

        ---
        [資產資訊]
        ${detailsBlock.trim()}
        ---

        [任務指示]
        1. 評估幣別為新台幣 (TWD)。
        2. 請回傳估算的**總價值**。
        3. 您的回覆必須**僅僅**包含一個純數字格式的金額。
        4. **不要**使用任何縮寫（例如「萬」或「百萬」）。
        5. **不要**包含任何文字說明、貨幣符號、千分位逗號或標點符號。

        例如：如果估算價值為新台幣三百五十萬 (3,500,000)，請回傳：
        3500000
      `;

    console.log("Gemini prompt:", prompt);
    // .trim() 移除開頭和結尾的空白，使 prompt 更乾淨
    return prompt.trim();
  }

  private parseValuationResponse(responseText: string): number {
    const cleanedText = responseText.replace(/[^0-9.]/g, "");
    const value = parseFloat(cleanedText);

    if (isNaN(value)) {
      throw new Error("The AI returned a non-numeric response.");
    }

    return value;
  }
}
