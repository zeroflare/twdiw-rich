/* eslint-env browser */
// Dashboard JavaScript
let pollingInterval = null;
let countdownInterval = null;
let animatedNetWorth = 0;

// 頁面載入時初始化
document.addEventListener("DOMContentLoaded", () => {
  void loadDashboardData();
  void loadRankCertificate();
  void loadIncomeCertificates();
  void loadUserInfo();

  // 設置事件監聽器
  document.getElementById("claim-rank-btn")?.addEventListener("click", claimRankCertificate);
  document.getElementById("close-modal")?.addEventListener("click", closeModal);
  document.getElementById("close-modal-btn")?.addEventListener("click", closeModal);
  document.getElementById("refresh-btn")?.addEventListener("click", () => {
    void refreshDashboard();
  });
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// 載入使用者資訊
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
      document.getElementById("user-name").textContent = user.name || user.email || "使用者";
      document.getElementById("user-email").textContent = user.email || "";
      document.getElementById("user-info").style.display = "flex";
      
      // Refresh Lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  } catch (error) {
    console.error("Error loading user info:", error);
    // 如果解析 JSON 失敗，可能是因為返回了 HTML（登入頁面）
    window.location.href = "/login";
  }
}

// 載入儀表板資料
async function loadDashboardData() {
  try {
    const [summaryRes, assetsRes, liabilitiesRes] = await Promise.all([
      fetch("/api/net-worth-summary", { credentials: "include" }),
      fetch("/api/assets", { credentials: "include" }),
      fetch("/api/liabilities", { credentials: "include" }),
    ]);

    // 檢查是否被重定向到登入頁面（檢查 Content-Type）
    const summaryContentType = summaryRes.headers.get("content-type");
    const assetsContentType = assetsRes.headers.get("content-type");
    const liabilitiesContentType = liabilitiesRes.headers.get("content-type");
    
    if (
      summaryContentType?.includes("text/html") ||
      assetsContentType?.includes("text/html") ||
      liabilitiesContentType?.includes("text/html") ||
      summaryRes.status === 401 ||
      assetsRes.status === 401 ||
      liabilitiesRes.status === 401
    ) {
      window.location.href = "/login";
      return;
    }

    const summary = await summaryRes.json();
    const assets = await assetsRes.json();
    const liabilities = await liabilitiesRes.json();

    // 去重處理
    const deduplicatedAssets = deduplicateByUuid(assets);
    const deduplicatedLiabilities = deduplicateByUuid(liabilities);

    // 更新 UI
    updateSummary(summary);
    updateAssets(deduplicatedAssets);
    updateLiabilities(deduplicatedLiabilities);

    document.getElementById("loading").style.display = "none";
    document.getElementById("content").style.display = "block";
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    // 如果解析 JSON 失敗，可能是因為返回了 HTML（登入頁面）
    window.location.href = "/login";
  }
}

// 更新摘要
function updateSummary(summary) {
  document.getElementById("total-assets").textContent = formatNumber(summary.assets);
  document.getElementById("total-liabilities").textContent = formatNumber(summary.liabilities);

  // 動畫顯示淨資產
  animateNetWorth(summary.netWorth);

  // 顯示 PR 值
  if (summary.prValue > 0) {
    document.getElementById("pr-value").style.display = "flex";
    document.getElementById("pr-percentage").textContent = summary.prValue.toFixed(1);
  }

  // 計算並顯示資產負債比例
  updateAssetLiabilityRatio(summary.assets, summary.liabilities);
  
  // 更新統計卡片
  updateStatisticsCards(summary);
}

// 更新資產負債比例
function updateAssetLiabilityRatio(assets, liabilities) {
  const ratioEl = document.getElementById("asset-liability-ratio");
  if (!ratioEl) return;
  
  if (assets === 0 && liabilities === 0) {
    ratioEl.textContent = "";
    return;
  }
  
  const total = assets + liabilities;
  if (total === 0) {
    ratioEl.textContent = "";
    return;
  }
  
  const assetPercent = ((assets / total) * 100).toFixed(1);
  const liabilityPercent = ((liabilities / total) * 100).toFixed(1);
  
  ratioEl.innerHTML = `
    <span class="text-emerald-600 font-semibold">資產 ${assetPercent}%</span>
    <span class="mx-2">·</span>
    <span class="text-red-600 font-semibold">負債 ${liabilityPercent}%</span>
  `;
}

// 更新統計卡片
function updateStatisticsCards(summary) {
  const container = document.getElementById("statistics-cards");
  if (!container) return;
  
  const netWorth = summary.netWorth;
  const assets = summary.assets;
  const liabilities = summary.liabilities;
  
  // 計算負債比率
  const debtRatio = assets > 0 ? ((liabilities / assets) * 100).toFixed(1) : 0;
  
  // 計算健康度評分（簡單的評分系統）
  let healthScore = 100;
  let healthLabel = "優秀";
  let healthColor = "emerald";
  
  if (debtRatio > 50) {
    healthScore = 50;
    healthLabel = "需注意";
    healthColor = "orange";
  } else if (debtRatio > 30) {
    healthScore = 70;
    healthLabel = "良好";
    healthColor = "yellow";
  }
  
  if (netWorth < 0) {
    healthScore = 20;
    healthLabel = "需改善";
    healthColor = "red";
  }
  
  container.innerHTML = `
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm text-slate-600 font-medium">財務健康度</div>
        <i data-lucide="activity" class="w-5 h-5 text-blue-600"></i>
      </div>
      <div class="text-3xl font-bold text-blue-600 mb-1">${healthScore}</div>
      <div class="text-xs text-slate-500">${healthLabel}</div>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm text-slate-600 font-medium">負債比率</div>
        <i data-lucide="percent" class="w-5 h-5 text-slate-600"></i>
      </div>
      <div class="text-3xl font-bold text-slate-700 mb-1">${debtRatio}%</div>
      <div class="text-xs text-slate-500">${debtRatio < 30 ? "健康" : debtRatio < 50 ? "可接受" : "偏高"}</div>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm text-slate-600 font-medium">資產項目</div>
        <i data-lucide="layers" class="w-5 h-5 text-slate-600"></i>
      </div>
      <div class="text-3xl font-bold text-slate-700 mb-1" id="stat-assets-count">0</div>
      <div class="text-xs text-slate-500">項資產記錄</div>
    </div>
  `;
  
  // 初始化 Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 重新整理儀表板
async function refreshDashboard() {
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    const icon = refreshBtn.querySelector("i");
    if (icon) {
      icon.setAttribute("data-lucide", "loader-2");
      icon.classList.add("animate-spin");
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
    refreshBtn.disabled = true;
  }
  
  document.getElementById("loading").style.display = "block";
  document.getElementById("content").style.display = "none";
  
  try {
    await Promise.all([
      loadDashboardData(),
      loadRankCertificate(),
      loadIncomeCertificates(),
    ]);
  } finally {
    if (refreshBtn) {
      const icon = refreshBtn.querySelector("i");
      if (icon) {
        icon.setAttribute("data-lucide", "refresh-cw");
        icon.classList.remove("animate-spin");
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
      refreshBtn.disabled = false;
    }
  }
}

// 動畫顯示淨資產
function animateNetWorth(targetValue) {
  if (targetValue <= 0) {
    document.getElementById("net-worth").textContent = "$0";
    return;
  }

  animatedNetWorth = 0;

  setTimeout(() => {
    const duration = 2000;
    const steps = 60;
    const increment = targetValue / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const animationInterval = setInterval(() => {
      currentStep++;
      const newValue = Math.min(increment * currentStep, targetValue);
      animatedNetWorth = Math.floor(newValue);
      document.getElementById("net-worth").textContent =
        "$" + formatNumber(animatedNetWorth);

      if (currentStep >= steps) {
        document.getElementById("net-worth").textContent = "$" + formatNumber(targetValue);
        clearInterval(animationInterval);
      }
    }, stepDuration);
  }, 100);
}

// 更新資產列表
function updateAssets(assets) {
  const totalAssets = assets.reduce((sum, asset) => sum + (asset.current_value || 0), 0);
  
  document.getElementById("assets-count").textContent = assets.length;
  document.getElementById("assets-total-display").textContent = formatNumber(totalAssets);
  document.getElementById("stat-assets-count").textContent = assets.length;

  const container = document.getElementById("assets-content");
  if (!container) return;
  
  // 確保容器預設顯示
  container.style.display = "block";
  
  if (assets.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center">
        <i data-lucide="trending-up" class="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50"></i>
        <div class="text-lg text-slate-700 font-semibold mb-2">尚無資產記錄</div>
        <div class="text-sm text-slate-500">請前往「資產憑證登記」頁面登記資產憑證</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  // 按類型分組
  const grouped = groupBy(assets, "asset_type");
  const typeNames = {
    CASH_AND_EQUIVALENTS: "銀行帳戶",
    SECURITIES: "證券戶",
    REAL_ESTATE: "不動產",
    VEHICLE: "車輛",
  };
  
  const typeColors = {
    CASH_AND_EQUIVALENTS: "from-emerald-500 to-teal-600",
    SECURITIES: "from-blue-500 to-indigo-600",
    REAL_ESTATE: "from-purple-500 to-pink-600",
    VEHICLE: "from-orange-500 to-red-600",
  };

  let html = "";
  for (const [type, items] of Object.entries(grouped)) {
    const typeTotal = items.reduce((sum, item) => sum + (item.current_value || 0), 0);
    const typePercent = totalAssets > 0 ? ((typeTotal / totalAssets) * 100).toFixed(1) : 0;
    
    html += `
      <div class="mb-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
          <div class="flex items-center gap-3">
            <span class="inline-block px-3 py-1.5 bg-emerald-500 text-white rounded-md text-sm font-semibold">${typeNames[type] || type}</span>
            <span class="text-sm text-slate-500 font-medium">${items.length} 項</span>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold text-slate-900">$${formatNumber(typeTotal)}</div>
            <div class="text-xs text-slate-500">佔 ${typePercent}%</div>
          </div>
        </div>
        <div class="space-y-3">
          ${items
            .map(
              (asset) => `
            <div class="flex justify-between items-start p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-900 mb-1">${asset.asset_name}</div>
                ${asset.asset_type === "REAL_ESTATE" && asset.location ? `<div class="text-xs text-slate-500 flex items-center gap-1 mt-1"><i data-lucide="map-pin" class="w-3 h-3"></i>${asset.location}</div>` : ""}
                ${asset.asset_type === "VEHICLE" && asset.model_no ? `<div class="text-xs text-slate-500 flex items-center gap-1 mt-1"><i data-lucide="car" class="w-3 h-3"></i>${asset.model_no}${asset.model_year ? ` · ${asset.model_year}年` : ""}</div>` : ""}
              </div>
              <div class="ml-4 text-right flex-shrink-0">
                <div class="font-bold text-emerald-600 text-lg">$${formatNumber(asset.current_value || 0)}</div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  
  // 初始化 Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 更新負債列表
function updateLiabilities(liabilities) {
  const totalLiabilities = liabilities.reduce((sum, liability) => sum + (liability.remaining_balance || 0), 0);
  
  document.getElementById("liabilities-count").textContent = liabilities.length;
  document.getElementById("liabilities-total-display").textContent = formatNumber(totalLiabilities);

  const container = document.getElementById("liabilities-content");
  if (!container) return;
  
  // 確保容器預設顯示
  container.style.display = "block";
  
  if (liabilities.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center">
        <i data-lucide="trending-down" class="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50"></i>
        <div class="text-lg text-slate-700 font-semibold mb-2">尚無負債記錄</div>
        <div class="text-sm text-slate-500">恭喜！目前沒有負債</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  // 按類型分組
  const grouped = groupBy(liabilities, "liability_type");
  const typeNames = {
    MORTGAGE: "房貸",
    PERSONAL_LOAN: "個人貸款",
    STUDENT_LOAN: "學貸",
    CAR_LOAN: "車貸",
    CREDIT_CARD_DEBT: "信用卡債務",
  };
  
  const typeColors = {
    MORTGAGE: "from-red-500 to-orange-600",
    PERSONAL_LOAN: "from-pink-500 to-rose-600",
    STUDENT_LOAN: "from-purple-500 to-indigo-600",
    CAR_LOAN: "from-orange-500 to-red-600",
    CREDIT_CARD_DEBT: "from-red-600 to-pink-600",
  };

  let html = "";
  for (const [type, items] of Object.entries(grouped)) {
    const typeTotal = items.reduce((sum, item) => sum + (item.remaining_balance || 0), 0);
    const typePercent = totalLiabilities > 0 ? ((typeTotal / totalLiabilities) * 100).toFixed(1) : 0;
    
    html += `
      <div class="mb-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
          <div class="flex items-center gap-3">
            <span class="inline-block px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-semibold">${typeNames[type] || type}</span>
            <span class="text-sm text-slate-500 font-medium">${items.length} 項</span>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold text-slate-900">$${formatNumber(typeTotal)}</div>
            <div class="text-xs text-slate-500">佔 ${typePercent}%</div>
          </div>
        </div>
        <div class="space-y-3">
          ${items
            .map(
              (liability) => `
            <div class="flex justify-between items-start p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-900 mb-1">${liability.liability_name}</div>
                ${liability.interest_rate ? `<div class="text-xs text-slate-500 flex items-center gap-1 mt-1"><i data-lucide="percent" class="w-3 h-3"></i>利率 ${liability.interest_rate}%</div>` : ""}
              </div>
              <div class="ml-4 text-right flex-shrink-0">
                <div class="font-bold text-red-600 text-lg">$${formatNumber(liability.remaining_balance || 0)}</div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  
  // 初始化 Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 載入財富階層憑證
async function loadRankCertificate() {
  try {
    const response = await fetch("/api/rank-certificate", { credentials: "include" });
    
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
      const data = await response.json();
      if (data.exists) {
        displayRankCertificate(data.certificate);
      } else {
        document.getElementById("claim-rank-btn").style.display = "block";
      }
    }
  } catch (error) {
    console.error("Error loading rank certificate:", error);
    // 如果解析 JSON 失敗，可能是因為返回了 HTML（登入頁面）
    // 但這裡不跳轉，因為可能只是這個 API 失敗，其他 API 可能成功
  }
}

// 顯示財富階層憑證
function displayRankCertificate(certificate) {
  const container = document.getElementById("rank-certificate-display");
  const claimTime = new Date(certificate.created_at * 1000).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  
  container.innerHTML = `
    <div class="relative mt-6 p-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg text-white text-center shadow-lg overflow-hidden">
      <button class="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white text-sm font-semibold cursor-pointer transition-all hover:bg-white/30 hover:border-white/50 hover:-translate-y-0.5 hover:shadow-lg z-10" id="reclaim-rank-btn" title="重新領取憑證">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        <span class="hidden md:inline">重新領取</span>
      </button>
      <div class="text-5xl mb-4 filter drop-shadow-lg">
        <i data-lucide="award" class="w-16 h-16 mx-auto"></i>
      </div>
      <div class="text-2xl font-bold mb-5 text-shadow">${certificate.rank}</div>
      <div class="w-16 h-1 bg-white/50 mx-auto mb-5 rounded"></div>
      <div class="flex flex-col gap-2 pt-4 border-t border-white/20">
        <span class="text-sm opacity-90 font-medium">領取時間</span>
        <span class="text-base font-semibold opacity-100 font-mono">${claimTime}</span>
      </div>
    </div>
  `;
  // Refresh Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  container.style.display = "block";
  document.getElementById("claim-rank-btn-container").style.display = "none";
  
  // 設置重新領取按鈕的事件監聽器
  document.getElementById("reclaim-rank-btn")?.addEventListener("click", claimRankCertificate);
}

// 領取財富階層憑證
async function claimRankCertificate() {
  const btn = document.getElementById("claim-rank-btn") || document.getElementById("reclaim-rank-btn");
  if (btn) {
    btn.disabled = true;
      if (btn.id === "reclaim-rank-btn") {
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span class="hidden md:inline ml-2">領取中...</span>';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } else {
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 mr-2 animate-spin"></i>領取中...';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
  }

  try {
    // 先領取憑證到資料庫
    const claimResponse = await fetch("/api/claim-rank-certificate", {
      method: "POST",
      credentials: "include",
    });

    if (!claimResponse.ok) {
      throw new Error("領取憑證失敗");
    }

    const claimData = await claimResponse.json();

    // 獲取今天的日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const issuanceDate = `${year}${month}${day}`;

    // 獲取一年後的日期
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(today.getFullYear() + 1);
    const expYear = oneYearLater.getFullYear();
    const expMonth = String(oneYearLater.getMonth() + 1).padStart(2, "0");
    const expDay = String(oneYearLater.getDate()).padStart(2, "0");
    const expiredDate = `${expYear}${expMonth}${expDay}`;

    // 生成憑證 QR Code
    const qrResponse = await fetch("/api/rank-certificate/generate-qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        rank: claimData.rank,
        issuanceDate,
        expiredDate,
      }),
    });

    if (!qrResponse.ok) {
      throw new Error("生成 QR Code 失敗");
    }

    const qrData = await qrResponse.json();

    // 顯示 QR Code 彈窗
    document.getElementById("qr-code-image").src = qrData.qrCode;
    document.getElementById("qr-modal").style.display = "flex";
    document.getElementById("qr-status").textContent = "請使用數位憑證皮夾 APP 掃描此 QR Code";

    // 開始輪詢
    startPolling(qrData.transactionId);
  } catch (error) {
    console.error("Error claiming rank certificate:", error);
    alert("領取憑證時發生錯誤");
    if (btn) {
      btn.disabled = false;
      if (btn.id === "reclaim-rank-btn") {
        btn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i><span class="hidden md:inline ml-2">重新領取</span>';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } else {
        btn.innerHTML = '<i data-lucide="award" class="w-5 h-5 mr-2"></i>領取財富階層憑證';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    }
  }
}

// 開始輪詢憑證狀態
function startPolling(transactionId) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/issuer/query-credential/${transactionId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === "61010") {
          return; // 繼續等待
        }
        throw new Error(errorData.message || "查詢憑證失敗");
      }

      const data = await response.json();

      // 成功
      const statusEl = document.getElementById("qr-status");
      statusEl.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 inline-block mr-2 text-green-600"></i>憑證領取成功！';
      document.getElementById("success-info").style.display = "block";
      document.getElementById("credential-cid").textContent = data.cid || "N/A";
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      clearInterval(pollingInterval);

      // 恢復按鈕狀態
      const reclaimBtn = document.getElementById("reclaim-rank-btn");
      if (reclaimBtn) {
        reclaimBtn.disabled = false;
        reclaimBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i><span class="hidden md:inline ml-2">重新領取</span>';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }

      // 倒數計時並自動關閉
      let countdown = 5;
      const countdownElement = document.getElementById("countdown-timer");
      if (countdownElement) {
        // 清除之前的倒數計時器（如果存在）
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
        countdownElement.textContent = countdown;
        countdownInterval = setInterval(() => {
          countdown--;
          countdownElement.textContent = countdown;
          if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            closeModal();
            void loadRankCertificate();
          }
        }, 1000);
      } else {
        // 如果找不到倒數元素，使用原來的 setTimeout
        setTimeout(() => {
          closeModal();
          void loadRankCertificate();
        }, 5000);
      }
    } catch (err) {
      console.error("Error polling credential:", err);
    }
  }, 5000);
}

// 關閉彈窗
function closeModal() {
  document.getElementById("qr-modal").style.display = "none";
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// 此函數已不再需要，因為明細預設展開
// 保留以備將來需要時使用

// 工具函數
function deduplicateByUuid(items) {
  const uuidMap = new Map();

  items.forEach((item) => {
    const uuid = item.uuid;
    const key = uuid || item.asset_name || item.liability_name;
    const existing = uuidMap.get(key);

    if (!existing || item.created_at > existing.created_at) {
      uuidMap.set(key, item);
    }
  });

  return Array.from(uuidMap.values());
}

function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

function formatNumber(num) {
  return parseFloat(num).toLocaleString();
}

// 載入年收入憑證
async function loadIncomeCertificates() {
  try {
    const response = await fetch("/api/income-certificates", { credentials: "include" });
    
    // 檢查是否被重定向到登入頁面
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      return;
    }
    
    if (response.status === 401) {
      return;
    }
    
    if (response.ok) {
      const certificates = await response.json();
      displayIncomeCertificates(certificates);
    }
  } catch (error) {
    console.error("Error loading income certificates:", error);
  }
}

// 顯示年收入憑證
function displayIncomeCertificates(certificates) {
  const section = document.getElementById("income-info");
  const content = document.getElementById("income-content");
  
  if (!certificates || certificates.length === 0) {
    content.innerHTML = `
      <div class="text-center py-12">
        <i data-lucide="dollar-sign" class="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50"></i>
        <div class="text-xl text-slate-700 font-semibold mb-2">尚無年收入憑證記錄</div>
        <div class="text-sm text-slate-500">請前往「資產憑證登記」頁面登記年收入憑證</div>
      </div>
    `;
    section.style.display = "block";
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  // 按年份分組並排序
  const groupedByYear = certificates.reduce((acc, cert) => {
    const year = cert.year;
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(cert);
    return acc;
  }, {});

  // 按年份降序排列
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => parseInt(b) - parseInt(a));

  let html = "";
  
  // 計算總年收入
  const totalIncome = certificates.reduce((sum, cert) => sum + cert.value, 0);
  const currentYear = new Date().getFullYear();
  const currentYearIncome = certificates
    .filter(cert => cert.year === currentYear)
    .reduce((sum, cert) => sum + cert.value, 0);

  // 顯示總覽
  html += `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      <div class="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm text-slate-600 font-medium">${currentYear} 年度收入</div>
          <i data-lucide="calendar" class="w-5 h-5 text-slate-400"></i>
        </div>
        <div class="text-3xl md:text-4xl font-extrabold text-slate-900">$${formatNumber(currentYearIncome)}</div>
        <div class="text-xs text-slate-500 mt-2">${certificates.filter(cert => cert.year === currentYear).length} 筆記錄</div>
      </div>
      <div class="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm text-slate-600 font-medium">累計總收入</div>
          <i data-lucide="trending-up" class="w-5 h-5 text-slate-400"></i>
        </div>
        <div class="text-3xl md:text-4xl font-extrabold text-slate-900">$${formatNumber(totalIncome)}</div>
        <div class="text-xs text-slate-500 mt-2">共 ${certificates.length} 筆記錄</div>
      </div>
    </div>
  `;

  // 顯示各年份明細
  html += '<div class="income-years-list">';
  for (const year of sortedYears) {
    const yearCerts = groupedByYear[year];
    const yearTotal = yearCerts.reduce((sum, cert) => sum + cert.value, 0);
    
    html += `
      <div class="bg-white rounded-xl p-5 border border-slate-200 mb-4 shadow-sm">
        <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
          <div class="flex items-center gap-3">
            <span class="inline-block px-3 py-1.5 bg-slate-700 text-white rounded-md text-sm font-semibold">${year} 年</span>
            <span class="text-xs text-slate-500 font-medium">${yearCerts.length} 筆記錄</span>
          </div>
          <div class="text-right">
            <div class="text-xl md:text-2xl font-bold text-slate-900">$${formatNumber(yearTotal)}</div>
            <div class="text-xs text-slate-500">年度總額</div>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          ${yearCerts.map(cert => `
            <div class="flex justify-between items-start p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-900 mb-1">${cert.description || "年收入憑證"}</div>
                <div class="text-xs text-slate-500 flex items-center gap-1">
                  <i data-lucide="calendar" class="w-3 h-3"></i>
                  ${cert.created_at ? new Date(cert.created_at * 1000).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" }) : ""}
                </div>
              </div>
              <div class="ml-4 text-right flex-shrink-0">
                <div class="font-bold text-slate-900 text-lg">$${formatNumber(cert.value)}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
  html += "</div>";

  content.innerHTML = html;
  section.style.display = "block";
  // Refresh Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 更新統計卡片中的資產數量（當資產更新時）
function updateStatisticsCardsAssets(count) {
  const statAssetsCount = document.getElementById("stat-assets-count");
  if (statAssetsCount) {
    statAssetsCount.textContent = count;
  }
}
