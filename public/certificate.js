/* eslint-env browser */
// Certificate JavaScript
let pollingInterval = null;
let userCertificates = [];
let userSettings = { gemini_api_key: null };

document.addEventListener("DOMContentLoaded", () => {
  void loadCertificates();
  void loadUserInfo(); // 這個函數現在會同時載入使用者資訊和設定
  document.getElementById("generate-qr-btn")?.addEventListener("click", generateQRCode);
  document.getElementById("reset-btn")?.addEventListener("click", resetQRCode);
  document.getElementById("settings-btn")?.addEventListener("click", showSettingsModal);

  // 使用事件委派處理刪除按鈕點擊
  document.getElementById("certificates-list")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-delete") || e.target.closest(".btn-delete")) {
      const btn = e.target.classList.contains("btn-delete")
        ? e.target
        : e.target.closest(".btn-delete");
      const certItem = btn.closest(".certificate-item-text");
      if (!certItem) return;
      const certId = certItem.dataset.certId;
      const isLiability = certItem.dataset.isLiability === "true";
      const isIncome = certItem.dataset.isIncome === "true";
      void deleteCertificate(certId, isLiability, isIncome);
    } else if (e.target.classList.contains("btn-ai-analyze") || e.target.closest(".btn-ai-analyze")) {
      const btn = e.target.classList.contains("btn-ai-analyze")
        ? e.target
        : e.target.closest(".btn-ai-analyze");
      const certItem = btn.closest(".certificate-item-text");
      if (!certItem) return;

      const certId = certItem.dataset.certId;
      const isLiability = certItem.dataset.isLiability === "true";
      void analyzeAssetValue(certId, isLiability, btn);
    }
  });
});

// 載入使用者資訊和設定（從 /api/user 獲取）
async function loadUserInfo() {
  try {
    const response = await fetch("/api/user", { credentials: "include" });
    
    // 檢查是否被重定向到登入頁面
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      window.location.href = "/login";
      return;
    }
    
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    
    if (response.ok) {
      const user = await response.json();
      
      // 更新使用者資訊顯示
      document.getElementById("user-name").textContent = user.name || user.email || "使用者";
      document.getElementById("user-email").textContent = user.email || "";
      document.getElementById("user-info").style.display = "block";
      
      // 更新使用者設定（只記錄是否有設定，不儲存完整的 key）
      userSettings = { 
        gemini_api_key: user.settings?.has_gemini_api_key ? "***" : null 
      };
      
      // 重新顯示憑證列表以更新按鈕狀態
      if (userCertificates.length > 0) {
        displayCertificates(userCertificates);
      }
    }
  } catch (error) {
    console.error("Error loading user info:", error);
    // 如果解析 JSON 失敗，可能是因為返回了 HTML（登入頁面）
    window.location.href = "/login";
  }
}

async function loadCertificates() {
  try {
    const [assetsRes, liabilitiesRes, incomeCertificatesRes] = await Promise.all([
      fetch("/api/assets", { credentials: "include" }),
      fetch("/api/liabilities", { credentials: "include" }),
      fetch("/api/income-certificates", { credentials: "include" }),
    ]);

    // 檢查是否被重定向到登入頁面（檢查 Content-Type）
    const assetsContentType = assetsRes.headers.get("content-type");
    const liabilitiesContentType = liabilitiesRes.headers.get("content-type");
    const incomeCertificatesContentType = incomeCertificatesRes.headers.get("content-type");
    
    if (
      assetsContentType?.includes("text/html") ||
      liabilitiesContentType?.includes("text/html") ||
      incomeCertificatesContentType?.includes("text/html") ||
      assetsRes.status === 401 ||
      liabilitiesRes.status === 401 ||
      incomeCertificatesRes.status === 401
    ) {
      window.location.href = "/login";
      return;
    }

    const assets = await assetsRes.json();
    const liabilities = await liabilitiesRes.json();
    const incomeCertificates = await incomeCertificatesRes.json();

    const certificates = [
      ...assets.map((a) => ({
        id: a.asset_id,
        type: a.certificate_type || "0052696330_vp_liquid_finance_certificate",
        typeName: getAssetTypeName(a.asset_type),
        name: a.asset_name,
        value: a.current_value,
        timestamp: new Date(a.created_at * 1000),
        details: a,
      })),
      ...liabilities.map((l) => ({
        id: `liability_${l.liability_id}`,
        type: l.certificate_type || "0052696330_vp_credit_liability_certificate",
        typeName: "負債",
        name: l.liability_name,
        value: l.remaining_balance,
        timestamp: new Date(l.created_at * 1000),
        details: l,
      })),
      ...incomeCertificates.map((ic) => ({
        id: `income_${ic.income_certificate_id}`,
        type: ic.certificate_type || "0052696330_vp_income_certificate",
        typeName: ic.type === "ANNUAL_INCOME" ? "年收入" : ic.type || "年收入",
        name: ic.description,
        value: ic.value,
        timestamp: new Date(ic.created_at * 1000),
        details: ic,
        isIncome: true,
      })),
    ];

    userCertificates = certificates;
    displayCertificates(certificates);
  } catch (error) {
    console.error("Error loading certificates:", error);
    // 如果解析 JSON 失敗，可能是因為返回了 HTML（登入頁面）
    window.location.href = "/login";
  }
}

function displayCertificates(certificates) {
  const container = document.getElementById("certificates-list");

  if (certificates.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>尚無登記的憑證</p><p class="empty-hint">請在右側選擇憑證類型並完成登記</p></div>';
    return;
  }

  const typeNames = {
    "0052696330_vp_liquid_finance_certificate": "流動性金融憑證",
    "0052696330_vp_real_estate_asset_certificate": "不動產資產憑證",
    "0052696330_vp_personal_property_certificate": "動產憑證",
    "0052696330_vp_credit_liability_certificate": "信用與負債憑證",
    "0052696330_vp_income_certificate": "年收入憑證",
  };

  container.innerHTML = certificates
    .map((cert) => {
      const isLiability = cert.id.startsWith("liability_");
      const isIncome = cert.id.startsWith("income_");
      const actualId = isLiability 
        ? cert.id.replace("liability_", "") 
        : isIncome 
        ? cert.id.replace("income_", "")
        : cert.id;
      const isAnalyzable =
        cert.type === "0052696330_vp_real_estate_asset_certificate" ||
        cert.type === "0052696330_vp_personal_property_certificate";

      return `
    <div class="certificate-item-text" data-cert-id="${actualId}" data-is-liability="${isLiability}" data-is-income="${isIncome}">
      <div class="cert-badges-row">
        <div class="cert-category-badge">${typeNames[cert.type] || "未知憑證"}</div>
        <div class="cert-type-badge">${cert.typeName}</div>
      </div>
      <div class="certificate-row">
        <div class="cert-info-group">
          <span class="cert-info">${cert.name}</span>
          <span class="cert-value">${cert.value === 0 || !cert.value ? "待估值" : `$${formatNumber(cert.value)}`}</span>
        </div>
        <div class="cert-actions">
          ${isAnalyzable
            ? `<button class="btn-ai-analyze ${!userSettings.gemini_api_key ? 'btn-disabled' : ''}" 
                 title="${!userSettings.gemini_api_key ? '請先設定 Gemini API Key' : 'AI 估值'}" 
                 ${!userSettings.gemini_api_key ? 'disabled' : ''}>AI 估值</button>`
            : ""}
          <span class="cert-status">✓</span>
          <span class="cert-time">${cert.timestamp.toLocaleTimeString("zh-TW")}</span>
          <button class="btn-delete" title="刪除憑證">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
    })
    .join("");
}

let animationFrameId = null;

async function analyzeAssetValue(certId, isLiability, btn) {
  // 檢查是否設定了 API Key
  if (!userSettings.gemini_api_key) {
    alert("請先前往設定頁面設定 Gemini API Key 才能使用 AI 估值功能。");
    showSettingsModal();
    return;
  }

  const cert = userCertificates.find(c => {
    const actualId = isLiability ? c.id.replace("liability_", "") : c.id;
    return actualId === certId;
  });

  if (!cert) {
    alert("找不到憑證資料");
    return;
  }

  // 先顯示確認視窗
  showConfirmAnalysisModal(cert, certId, isLiability);
}

function showConfirmAnalysisModal(cert, certId, isLiability) {
  // 移除現有的 Modal（如果存在）
  const existingModal = document.getElementById("confirm-analysis-modal");
  if (existingModal) {
    existingModal.remove();
  }

  // 根據資產類型準備顯示的資訊
  const assetType = cert.details.asset_type;
  const isRealEstate = assetType === "REAL_ESTATE";
  const isVehicle = assetType === "VEHICLE";
  
  let assetInfoHtml = "";
  
  if (isRealEstate) {
    // 不動產資訊
    assetInfoHtml = `
      <div class="asset-info-section">
        <h3 style="margin-bottom: 16px; color: #2d3748;">不動產資訊</h3>
        <div class="info-row">
          <span class="info-label">資產名稱：</span>
          <span class="info-value">${cert.name || "未提供"}</span>
        </div>
        ${cert.details.location ? `
        <div class="info-row">
          <span class="info-label">位置：</span>
          <span class="info-value">${cert.details.location}</span>
        </div>
        ` : ""}
        ${cert.details.size_ping ? `
        <div class="info-row">
          <span class="info-label">坪數：</span>
          <span class="info-value">${cert.details.size_ping} 坪</span>
        </div>
        ` : ""}
        <div class="info-row">
          <span class="info-label">目前價值：</span>
          <span class="info-value">${cert.details.current_value === 0 || !cert.details.current_value ? "待估值" : `$${formatNumber(cert.details.current_value)}`}</span>
        </div>
      </div>
    `;
  } else if (isVehicle) {
    // 動產資訊
    assetInfoHtml = `
      <div class="asset-info-section">
        <h3 style="margin-bottom: 16px; color: #2d3748;">動產資訊</h3>
        <div class="info-row">
          <span class="info-label">資產名稱：</span>
          <span class="info-value">${cert.name || "未提供"}</span>
        </div>
        ${cert.details.model_no ? `
        <div class="info-row">
          <span class="info-label">型號：</span>
          <span class="info-value">${cert.details.model_no}</span>
        </div>
        ` : ""}
        ${cert.details.model_year ? `
        <div class="info-row">
          <span class="info-label">年份：</span>
          <span class="info-value">${cert.details.model_year} 年</span>
        </div>
        ` : ""}
        <div class="info-row">
          <span class="info-label">目前價值：</span>
          <span class="info-value">${cert.details.current_value === 0 || !cert.details.current_value ? "待估值" : `$${formatNumber(cert.details.current_value)}`}</span>
        </div>
      </div>
    `;
  } else {
    // 其他類型
    assetInfoHtml = `
      <div class="asset-info-section">
        <h3 style="margin-bottom: 16px; color: #2d3748;">資產資訊</h3>
        <div class="info-row">
          <span class="info-label">資產名稱：</span>
          <span class="info-value">${cert.name || "未提供"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">目前價值：</span>
          <span class="info-value">${cert.details.current_value === 0 || !cert.details.current_value ? "待估值" : `$${formatNumber(cert.details.current_value)}`}</span>
        </div>
      </div>
    `;
  }

  // 創建確認 Modal
  const modal = document.createElement("div");
  modal.id = "confirm-analysis-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>確認 AI 估值</h2>
        <button class="modal-close" id="confirm-modal-close">×</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 20px; color: #4a5568;">請確認以下資產資訊，確認後將開始 AI 估值：</p>
        ${assetInfoHtml}
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button class="btn-secondary" id="confirm-modal-cancel">取消</button>
          <button class="btn-primary" id="confirm-modal-confirm">確認開始估值</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 儲存 cert 資料供後續使用
  window._pendingAnalysisCert = cert;
  window._pendingAnalysisCertId = certId;
  window._pendingAnalysisIsLiability = isLiability;

  // 綁定事件監聽器
  const closeBtn = modal.querySelector("#confirm-modal-close");
  const cancelBtn = modal.querySelector("#confirm-modal-cancel");
  const confirmBtn = modal.querySelector("#confirm-modal-confirm");

  const closeHandler = () => {
    closeConfirmAnalysisModal();
  };

  closeBtn.addEventListener("click", closeHandler);
  cancelBtn.addEventListener("click", closeHandler);
  confirmBtn.addEventListener("click", () => {
    startAnalysis(window._pendingAnalysisCertId, window._pendingAnalysisIsLiability);
  });

  // 點擊 Modal 外部關閉
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeConfirmAnalysisModal();
    }
  });
}

function closeConfirmAnalysisModal() {
  const modal = document.getElementById("confirm-analysis-modal");
  if (modal) {
    modal.remove();
  }
  window._pendingAnalysisCert = null;
  window._pendingAnalysisCertId = null;
  window._pendingAnalysisIsLiability = null;
}

async function startAnalysis(certId, isLiability) {
  // 先保存憑證資料，再關閉確認視窗
  const cert = window._pendingAnalysisCert;
  if (!cert) {
    alert("找不到憑證資料");
    closeConfirmAnalysisModal();
    return;
  }

  // 關閉確認視窗
  closeConfirmAnalysisModal();

  // 顯示分析 Modal 並開始數字跳動動畫
  const stopAnimation = showAnalysisModal(cert.name);

  try {
    const response = await fetch("/api/analyze-asset-value", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        assetName: cert.name,
        assetType: cert.details.asset_type,
        assetDetails: cert.details,
      }),
    });

    // 停止動畫
    stopAnimation();

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "AI 估值失敗");
    }

    const result = await response.json();
    
    // 顯示結果並提供保存選項
    showAnalysisResult(result.estimatedValue, certId, isLiability, cert);

  } catch (error) {
    // 停止動畫
    stopAnimation();
    console.error("Error analyzing asset value:", error);
    showAnalysisError(error.message);
  }
}

function showAnalysisModal(assetName) {
  // 移除現有的 Modal（如果存在）
  const existingModal = document.getElementById("ai-analysis-modal");
  if (existingModal) {
    existingModal.remove();
  }

  // 停止之前的動畫（如果存在）
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 創建 Modal
  const modal = document.createElement("div");
  modal.id = "ai-analysis-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>AI 價值估值</h2>
        <button class="modal-close" onclick="closeAnalysisModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 20px; color: #4a5568;">正在估值：<strong>${assetName}</strong></p>
        <div class="loading-animation">
          <div class="loading-number" id="loading-number">0</div>
          <p style="color: #718096; margin-top: 10px;">估值中...</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 點擊 Modal 外部關閉
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeAnalysisModal();
    }
  });

  // 開始數字跳動動畫
  let currentNumber = 0;
  const targetNumber = 100;
  const duration = 10000; // 10秒（足夠長，等待 API 響應）
  const startTime = Date.now();
  let isAnimating = true;
  
  const animateNumber = () => {
    if (!isAnimating) return;
    
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 使用緩動函數讓數字跳動更自然
    const easeOut = 1 - Math.pow(1 - progress, 3);
    currentNumber = Math.floor(easeOut * targetNumber);
    
    const numberElement = document.getElementById("loading-number");
    if (numberElement) {
      numberElement.textContent = currentNumber + "%";
    }
    
    if (progress < 1 && isAnimating) {
      animationFrameId = requestAnimationFrame(animateNumber);
    } else if (progress >= 1 && isAnimating) {
      // 如果動畫完成但 API 還沒響應，保持在 99%
      if (numberElement) {
        numberElement.textContent = "99%";
      }
    }
  };
  
  animationFrameId = requestAnimationFrame(animateNumber);

  // 返回停止動畫的函數
  return () => {
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    const numberElement = document.getElementById("loading-number");
    if (numberElement) {
      numberElement.textContent = "100%";
    }
  };
}

function showAnalysisResult(estimatedValue, certId, isLiability, cert) {
  const modalBody = document.querySelector("#ai-analysis-modal .modal-body");
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="text-align: center;">
      <p style="margin-bottom: 20px; color: #4a5568;">估值完成！</p>
      <div style="font-size: 2rem; font-weight: 700; color: #667eea; margin: 20px 0;">
        $${formatNumber(estimatedValue)}
      </div>
      <p style="color: #718096; margin-bottom: 24px;">AI 預估價值</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn-primary" onclick="saveAnalysisResult('${certId}', ${isLiability}, ${estimatedValue})">
          儲存價值
        </button>
        <button class="btn-secondary" onclick="closeAnalysisModal()">
          取消
        </button>
      </div>
    </div>
  `;
}

function showAnalysisError(errorMessage) {
  const modalBody = document.querySelector("#ai-analysis-modal .modal-body");
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="text-align: center;">
      <p style="margin-bottom: 20px; color: #e53e3e; font-weight: 600;">估值失敗</p>
      <p style="color: #718096; margin-bottom: 24px;">${errorMessage}</p>
      <button class="btn-secondary" onclick="closeAnalysisModal()">
        關閉
      </button>
    </div>
  `;
}

function closeAnalysisModal() {
  // 停止動畫
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  const modal = document.getElementById("ai-analysis-modal");
  if (modal) {
    modal.remove();
  }
}

async function saveAnalysisResult(certId, isLiability, estimatedValue) {
  if (isLiability) {
    alert("負債不支援 AI 價值估值");
    closeAnalysisModal();
    return;
  }

  try {
    const response = await fetch(`/api/assets/${certId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        current_value: estimatedValue,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "儲存失敗");
    }

    // 更新顯示
    const certItem = document.querySelector(`[data-cert-id="${certId}"][data-is-liability="false"]`);
    if (certItem) {
      const valueElement = certItem.querySelector(".cert-value");
      valueElement.textContent = `$${formatNumber(estimatedValue)} (AI評估)`;
    }

    // 顯示成功訊息
    const modalBody = document.querySelector("#ai-analysis-modal .modal-body");
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center;">
          <p style="margin-bottom: 20px; color: #48bb78; font-weight: 600;">✓ 儲存成功</p>
          <p style="color: #718096; margin-bottom: 24px;">價值已更新為 $${formatNumber(estimatedValue)}</p>
          <button class="btn-primary" onclick="closeAnalysisModal(); void loadCertificates();">
            確定
          </button>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error saving analysis result:", error);
    alert("儲存時發生錯誤：" + error.message);
  }
}

function getAssetTypeName(type) {
  const map = {
    CASH_AND_EQUIVALENTS: "銀行帳戶",
    SECURITIES: "證券戶",
    REAL_ESTATE: "不動產",
    VEHICLE: "車輛",
  };
  return map[type] || "資產";
}

async function generateQRCode() {
  const certType = document.getElementById("certificate-type").value;
  if (!certType) {
    alert("請選擇憑證類型");
    return;
  }

  try {
    const response = await fetch("/api/generate-certificate-qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ certificateType: certType }),
    });

    if (!response.ok) {
      throw new Error("生成 QR Code 失敗");
    }

    const data = await response.json();

    const typeNames = {
      "0052696330_vp_liquid_finance_certificate": "流動性金融憑證",
      "0052696330_vp_real_estate_asset_certificate": "不動產資產憑證",
      "0052696330_vp_personal_property_certificate": "動產憑證",
      "0052696330_vp_credit_liability_certificate": "信用與負債憑證",
      "0052696330_vp_income_certificate": "年收入憑證",
    };

    document.getElementById("cert-type-info").innerHTML =
      `<p style="color: #1976d2; font-weight: 600;">憑證類型: ${typeNames[certType] || "未知"}</p>`;
    document.getElementById("qrcode-image").src = data.qrcodeImage;
    document.getElementById("registration-form").style.display = "none";
    document.getElementById("qrcode-section").style.display = "block";

    startPolling(data.transactionId);
  } catch (error) {
    console.error("Error generating QR code:", error);
    alert("生成 QR Code 失敗");
  }
}

function startPolling(transactionId) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  let pollCount = 0;
  const maxPolls = 150; // 最多輪詢 5 分鐘 (150 * 2秒)

  pollingInterval = setInterval(async () => {
    pollCount++;

    try {
      const response = await fetch("/api/poll-certificate-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transactionId }),
      });

      if (!response.ok) {
        console.error("Poll response error:", response.status, await response.text());
        return;
      }

      const result = await response.json();
      console.log(`Poll #${pollCount} result:`, result);

      if (result.status === "completed") {
        document.getElementById("status-text").textContent = "✓ 登記完成";
        clearInterval(pollingInterval);

        setTimeout(() => {
          resetQRCode();
          loadCertificates();
        }, 3000);
      } else if (result.status === "pending") {
        // 更新狀態文字
        document.getElementById("status-text").textContent =
          result.message || "請使用數位憑證皮夾 APP 掃描 QR Code";

        // 如果輪詢次數過多，停止輪詢
        if (pollCount >= maxPolls) {
          clearInterval(pollingInterval);
          document.getElementById("status-text").textContent = "⏱️ QR Code 已過期，請重新生成";
          alert("QR Code 已過期（5分鐘），請重新生成");
        }
      }
    } catch (error) {
      console.error("Error polling result:", error);
      document.getElementById("status-text").textContent = "❌ 輪詢發生錯誤，請重新生成 QR Code";
      clearInterval(pollingInterval);
    }
  }, 2000);
}

function resetQRCode() {
  document.getElementById("registration-form").style.display = "block";
  document.getElementById("qrcode-section").style.display = "none";
  document.getElementById("certificate-type").value = "";

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

async function deleteCertificate(id, isLiability, isIncome) {
  if (!confirm("確定要刪除此憑證嗎？此操作無法復原。")) {
    return;
  }

  try {
    let endpoint;
    if (isIncome) {
      endpoint = `/api/income-certificates/${id}`;
    } else if (isLiability) {
      endpoint = `/api/liabilities/${id}`;
    } else {
      endpoint = `/api/assets/${id}`;
    }

    const response = await fetch(endpoint, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "刪除失敗");
    }

    // 重新載入憑證列表
    void loadCertificates();
  } catch (error) {
    console.error("Error deleting certificate:", error);
    alert("刪除憑證時發生錯誤：" + error.message);
  }
}

function formatNumber(num) {
  return parseFloat(num).toLocaleString();
}

// 設定相關功能
async function showSettingsModal() {
  // 移除現有的 Modal（如果存在）
  const existingModal = document.getElementById("settings-modal");
  if (existingModal) {
    existingModal.remove();
  }

  // 使用已載入的設定（只檢查是否有設定）
  const hasApiKey = userSettings.gemini_api_key !== null;

  // 創建 Modal
  const modal = document.createElement("div");
  modal.id = "settings-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>設定</h2>
        <button class="modal-close" onclick="closeSettingsModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="gemini-api-key">Gemini API Key</label>
          <input 
            type="password" 
            id="gemini-api-key" 
            class="form-control" 
            placeholder="${hasApiKey ? "已設定（輸入新值以更新）" : "請輸入您的 Gemini API Key"}"
            value=""
          />
          ${hasApiKey ? `<p style="font-size: 0.85rem; color: #48bb78; margin-top: 8px;">✓ API Key 已設定</p>` : ""}
          <p style="font-size: 0.85rem; color: #718096; margin-top: 8px;">
            用於 AI 估值功能。如果未設定，將無法使用 AI 估值功能。
          </p>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button class="btn-secondary" onclick="closeSettingsModal()">取消</button>
          <button class="btn-primary" onclick="saveSettings()">儲存</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 點擊 Modal 外部關閉
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeSettingsModal();
    }
  });
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    modal.remove();
  }
}

async function saveSettings() {
  const apiKeyInput = document.getElementById("gemini-api-key");
  const inputValue = apiKeyInput?.value.trim() || "";
  
  // 如果用戶沒有輸入新值，需要先獲取當前設定
  let apiKeyToSave = null;
  if (inputValue.length > 0) {
    apiKeyToSave = inputValue;
  } else {
    // 如果輸入為空，檢查是否要清除設定
    // 這裡我們允許用戶輸入空值來清除設定
    apiKeyToSave = null;
  }

  try {
    const response = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        gemini_api_key: apiKeyToSave,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "儲存失敗");
    }

    const result = await response.json();
    
    // 更新本地設定（只記錄是否有設定）
    userSettings.gemini_api_key = result.settings?.has_gemini_api_key ? "***" : null;
    
    // 重新顯示憑證列表以更新按鈕狀態
    if (userCertificates.length > 0) {
      displayCertificates(userCertificates);
    }

    // 顯示成功訊息
    const modalBody = document.querySelector("#settings-modal .modal-body");
    if (modalBody) {
      const message = inputValue.length > 0 
        ? "✓ 設定已儲存" 
        : "✓ API Key 已清除";
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="margin-bottom: 20px; color: #48bb78; font-weight: 600;">${message}</p>
          <button class="btn-primary" onclick="closeSettingsModal()">確定</button>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error saving settings:", error);
    alert("儲存設定時發生錯誤：" + error.message);
  }
}
