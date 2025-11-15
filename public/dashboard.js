/* eslint-env browser */
// Dashboard JavaScript
let pollingInterval = null;
let animatedNetWorth = 0;

// 頁面載入時初始化
document.addEventListener("DOMContentLoaded", () => {
  void loadDashboardData();
  void loadRankCertificate();
  void loadIncomeCertificates();
  void loadUserInfo();

  // 設置事件監聽器
  document.getElementById("assets-toggle")?.addEventListener("click", () => {
    toggleSection("assets-content", "assets-toggle");
  });

  document.getElementById("liabilities-toggle")?.addEventListener("click", () => {
    toggleSection("liabilities-content", "liabilities-toggle");
  });

  document.getElementById("claim-rank-btn")?.addEventListener("click", claimRankCertificate);
  document.getElementById("close-modal")?.addEventListener("click", closeModal);
  document.getElementById("close-modal-btn")?.addEventListener("click", closeModal);
  
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
  document.getElementById("assets-count").textContent = assets.length;

  const container = document.getElementById("assets-content");
  if (assets.length === 0) {
    container.innerHTML =
      '<div class="py-5 text-center text-slate-500">尚無資產記錄</div>';
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

  let html = "";
  for (const [type, items] of Object.entries(grouped)) {
    html += `
      <div class="mb-5 p-5 bg-slate-50 rounded-lg border border-slate-200">
        <div class="flex items-center justify-between mb-4 pb-3 border-b-2 border-slate-200">
          <div>
            <span class="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-md text-xs font-bold">${typeNames[type] || type}</span>
            <span class="text-xs text-blue-600 font-bold ml-2">(${items.length} 項)</span>
          </div>
        </div>
        ${items
          .map(
            (asset) => `
          <div class="flex justify-between items-center p-4 bg-white rounded-lg border-l-4 border-blue-600 mb-2 shadow-sm">
            <span class="font-semibold text-slate-900">${asset.asset_name}</span>
            <span class="font-bold text-blue-600">$${formatNumber(asset.current_value)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  container.innerHTML = html;
}

// 更新負債列表
function updateLiabilities(liabilities) {
  document.getElementById("liabilities-count").textContent = liabilities.length;

  const container = document.getElementById("liabilities-content");
  if (liabilities.length === 0) {
    container.innerHTML =
      '<div class="py-5 text-center text-slate-500">尚無負債記錄</div>';
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

  let html = "";
  for (const [type, items] of Object.entries(grouped)) {
    html += `
      <div class="mb-5 p-5 bg-slate-50 rounded-lg border border-slate-200">
        <div class="flex items-center justify-between mb-4 pb-3 border-b-2 border-slate-200">
          <div>
            <span class="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-md text-xs font-bold">${typeNames[type] || type}</span>
            <span class="text-xs text-blue-600 font-bold ml-2">(${items.length} 項)</span>
          </div>
        </div>
        ${items
          .map(
            (liability) => `
          <div class="flex justify-between items-center p-4 bg-white rounded-lg border-l-4 border-blue-600 mb-2 shadow-sm">
            <span class="font-semibold text-slate-900">${liability.liability_name}</span>
            <span class="font-bold text-blue-600">$${formatNumber(liability.remaining_balance)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  container.innerHTML = html;
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

      // 5 秒後自動關閉
      setTimeout(() => {
        closeModal();
        void loadRankCertificate();
      }, 5000);
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
}

// 切換區塊顯示
function toggleSection(contentId, toggleId) {
  const content = document.getElementById(contentId);
  const toggle = document.getElementById(toggleId);
  const iconId = contentId === "assets-content" ? "assets-icon" : "liabilities-icon";
  const icon = document.getElementById(iconId);

  if (content.style.display === "none") {
    content.style.display = "block";
    if (icon) {
      icon.setAttribute("data-lucide", "chevron-down");
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  } else {
    content.style.display = "none";
    if (icon) {
      icon.setAttribute("data-lucide", "chevron-right");
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
}

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
  const section = document.getElementById("income-section");
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
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
      <div class="text-center">
        <div class="text-sm text-slate-700 font-semibold mb-2">${currentYear} 年度收入</div>
        <div class="text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">$${formatNumber(currentYearIncome)}</div>
      </div>
      <div class="text-center">
        <div class="text-sm text-slate-700 font-semibold mb-2">累計總收入</div>
        <div class="text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">$${formatNumber(totalIncome)}</div>
      </div>
    </div>
  `;

  // 顯示各年份明細
  html += '<div class="income-years-list">';
  for (const year of sortedYears) {
    const yearCerts = groupedByYear[year];
    const yearTotal = yearCerts.reduce((sum, cert) => sum + cert.value, 0);
    
    html += `
      <div class="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-5">
        <div class="flex justify-between items-center mb-4 pb-3 border-b-2 border-slate-200">
          <span class="inline-block px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-bold">${year} 年</span>
          <span class="text-xl font-bold text-blue-600">$${formatNumber(yearTotal)}</span>
        </div>
        <div class="flex flex-col gap-3">
          ${yearCerts.map(cert => `
            <div class="flex justify-between items-center p-4 bg-white rounded-lg border-l-4 border-blue-500 transition-all hover:shadow-md hover:translate-x-1">
              <div class="flex-1 flex flex-col gap-1">
                <div class="font-semibold text-slate-900">${cert.description || "年收入憑證"}</div>
                <div class="text-xs text-slate-500">${cert.created_at ? new Date(cert.created_at * 1000).toLocaleDateString("zh-TW") : ""}</div>
              </div>
              <div class="font-bold text-blue-600 text-lg">$${formatNumber(cert.value)}</div>
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
