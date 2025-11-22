/* eslint-env browser */
// Admin JavaScript
const CERTIFICATE_CONFIGS = {
  liquid_finance_certificate: {
    name: "流動性金融憑證",
    vcUid: "0052696330_vc_liquid_finance_certificate",
    itemTypes: {
      CASH_AND_EQUIVALENT: { label: "銀行帳戶", fields: ["description", "value"] },
      SECURITIES: { label: "證券戶", fields: ["description", "value"] },
    },
  },
  real_estate_asset_certificate: {
    name: "不動產資產憑證",
    vcUid: "0052696330_vc_real_estate_asset_certificate",
    itemTypes: {
      REAL_ESTATE: { label: "不動產", fields: ["description", "location", "size_ping"] },
    },
  },
  personal_property_certificate: {
    name: "動產憑證",
    vcUid: "0052696330_vc_personal_property_certificate",
    itemTypes: {
      VEHICLE: { label: "車輛", fields: ["description", "model_no", "model_year"] },
    },
  },
  credit_liability_certificate: {
    name: "信用與負債憑證",
    vcUid: "0052696330_vc_credit_liability_certificate",
    itemTypes: {
      MORTGAGE: { label: "房貸", fields: ["description", "value"] },
      PERSONAL_LOAN: { label: "個人貸款", fields: ["description", "value"] },
      STUDENT_LOAN: { label: "學貸", fields: ["description", "value"] },
      CAR_LOAN: { label: "車貸", fields: ["description", "value"] },
      CREDIT_CARD_DEBT: { label: "信用卡債務", fields: ["description", "value"] },
    },
  },
  income_certificate: {
    name: "年收入憑證",
    vcUid: "0052696330_vc_income__certificate",
    itemTypes: {
      ANNUAL_INCOME: { label: "年收入", fields: ["uuid", "year", "value", "description", "type"] },
    },
  },
};

let pollingInterval = null;
let countdownInterval = null;
let currentIssuerInfo = null; // 儲存當前發行資訊，用於查詢時保存到資料庫

// 計算薪資百分位數並生成描述
function calculateIncomePercentile(income) {
  const incomeValue = parseFloat(income);
  if (isNaN(incomeValue) || incomeValue < 0) {
    return "";
  }

  // 十分位數閾值（個位數，萬元轉換為元）
  const percentiles = [
    { threshold: 316000, percentile: 5 },
    { threshold: 368000, percentile: 15 },
    { threshold: 413000, percentile: 25 },
    { threshold: 465000, percentile: 35 },
    { threshold: 525000, percentile: 45 },
    { threshold: 601000, percentile: 55 },
    { threshold: 720000, percentile: 65 },
    { threshold: 917000, percentile: 75 },
    { threshold: 1279000, percentile: 85 },
  ];

  // 找出對應的百分位數
  for (let i = 0; i < percentiles.length; i++) {
    if (incomeValue <= percentiles[i].threshold) {
      return `您的年收入贏過${percentiles[i].percentile}%的人`;
    }
  }

  // 超過第9十分位數
  return `您的年收入贏過95%的人`;
}

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
  void loadUserInfo();
  document
    .getElementById("certificate-type")
    ?.addEventListener("change", handleCertificateTypeChange);
  document.getElementById("item-type")?.addEventListener("change", handleItemTypeChange);
  document.getElementById("generate-btn")?.addEventListener("click", generateCertificate);
  document.getElementById("reset-btn")?.addEventListener("click", resetForm);
  document.getElementById("close-modal")?.addEventListener("click", closeModal);
  document.getElementById("close-modal-btn")?.addEventListener("click", closeModal);

  // Tab 切換 - 確保按鈕存在後再綁定事件
  const tabIssue = document.getElementById("tab-issue");
  const tabList = document.getElementById("tab-list");
  
  if (tabIssue) {
    tabIssue.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("issue");
    });
  }
  
  if (tabList) {
    tabList.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("list");
    });
  }

  // 設置預設日期
  setDefaultDates();
  
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

function setDefaultDates() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  document.getElementById("issuance-date").value = `${year}${month}${day}`;

  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(today.getFullYear() + 1);
  const expYear = oneYearLater.getFullYear();
  const expMonth = String(oneYearLater.getMonth() + 1).padStart(2, "0");
  const expDay = String(oneYearLater.getDate()).padStart(2, "0");
  document.getElementById("expired-date").value = `${expYear}${expMonth}${expDay}`;
}

function setupForm() {
  handleCertificateTypeChange();
}

function handleCertificateTypeChange() {
  const certType = document.getElementById("certificate-type").value;
  const config = CERTIFICATE_CONFIGS[certType];
  const itemTypeSelect = document.getElementById("item-type");

  itemTypeSelect.innerHTML = Object.keys(config.itemTypes)
    .map(
      (key) =>
        `<option value="${key}">${config.itemTypes[key].label} (${key})</option>`
    )
    .join("");

  handleItemTypeChange();
}

function handleItemTypeChange() {
  const certType = document.getElementById("certificate-type").value;
  const itemType = document.getElementById("item-type").value;
  const config = CERTIFICATE_CONFIGS[certType];
  const itemConfig = config.itemTypes[itemType];
  const container = document.getElementById("dynamic-fields");

  // 過濾掉 uuid 和 type 欄位（這些會自動處理，不需要顯示）
  const visibleFields = itemConfig.fields.filter((field) => field !== "uuid" && field !== "type");

  container.innerHTML = visibleFields
    .map((field) => {
      let label = "";
      let placeholder = "";
      let inputType = "text";

      switch (field) {
        case "description":
          label = "描述";
          placeholder = "項目描述";
          break;
        case "value":
          label = "金額";
          placeholder = "數值";
          inputType = "number";
          break;
        case "location":
          label = "地點";
          placeholder = "例如：台北市信義區";
          break;
        case "size_ping":
          label = "坪數";
          placeholder = "例如：30";
          inputType = "number";
          break;
        case "model_no":
          label = "型號";
          placeholder = "例如：Toyota Camry";
          break;
        case "model_year":
          label = "年份";
          placeholder = "例如：2020";
          inputType = "number";
          break;
        case "uuid":
          label = "UUID";
          placeholder = "自動生成";
          inputType = "text";
          break;
        case "year":
          label = "年份";
          placeholder = "例如：2024";
          inputType = "number";
          break;
        default:
          label = field;
      }

      const isReadonly = field === "uuid";
      const isDescription = field === "description";
      const isValue = field === "value";
      
      // 如果是年收入憑證的 value 欄位，添加事件監聽器來自動計算描述
      let inputAttributes = isReadonly ? 'readonly' : '';
      if (isDescription && certType === "income_certificate") {
        inputAttributes += ' readonly'; // 描述欄位設為唯讀，自動填入
      }
      
      return `
      <div class="space-y-2 mb-4">
        <label class="text-sm font-medium">${label}</label>
        <input type="${inputType}" id="field-${field}" class="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" placeholder="${placeholder}" ${inputAttributes} />
      </div>
    `;
    })
    .join("");
  
  // 如果是年收入憑證，為 value 欄位添加事件監聽器
  if (certType === "income_certificate") {
    const valueInput = document.getElementById("field-value");
    const descriptionInput = document.getElementById("field-description");
    
    if (valueInput && descriptionInput) {
      // 移除舊的事件監聽器（如果有的話）
      const newValueInput = valueInput.cloneNode(true);
      valueInput.parentNode.replaceChild(newValueInput, valueInput);
      
      // 添加新的事件監聽器
      newValueInput.addEventListener("input", () => {
        const income = newValueInput.value;
        if (income) {
          const description = calculateIncomePercentile(income);
          descriptionInput.value = description;
        } else {
          descriptionInput.value = "";
        }
      });
      
      // 如果 value 欄位已有值，立即計算描述
      if (newValueInput.value) {
        const description = calculateIncomePercentile(newValueInput.value);
        descriptionInput.value = description;
      }
    }
  }
}

async function generateCertificate() {
  const certType = document.getElementById("certificate-type").value;
  const itemType = document.getElementById("item-type").value;
  const config = CERTIFICATE_CONFIGS[certType];
  const itemConfig = config.itemTypes[itemType];

  // 驗證必填欄位（uuid 和 type 除外，因為會自動處理）
  for (const field of itemConfig.fields) {
    if (field === "uuid" || field === "type") continue; // uuid 和 type 會自動處理，跳過驗證
    const input = document.getElementById(`field-${field}`);
    if (!input || !input.value) {
      showError("請填寫所有必填欄位");
      return;
    }
  }

  const btn = document.getElementById("generate-btn");
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 mr-2 animate-spin"></i>生成中...';
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  hideError();

  try {
    // 生成 UUID
    const uuid = crypto.randomUUID();

    // 構建 fields（type 和 uuid 會自動帶入）
    const fields = [
      { ename: "type", content: itemType },
      { ename: "uuid", content: uuid },
    ];

    // 只處理可見的欄位（過濾掉 uuid 和 type）
    const visibleFields = itemConfig.fields.filter((field) => field !== "uuid" && field !== "type");
    for (const field of visibleFields) {
      const input = document.getElementById(`field-${field}`);
      if (input) {
        let fieldValue = input.value;
        
        // 如果是年收入憑證的 description 欄位，自動從 value 欄位計算
        if (certType === "income_certificate" && field === "description") {
          const valueInput = document.getElementById("field-value");
          if (valueInput && valueInput.value) {
            fieldValue = calculateIncomePercentile(valueInput.value);
          }
        }
        
        // 如果有值，加入 fields
        if (fieldValue) {
          fields.push({ ename: field, content: fieldValue });
        }
      }
    }

    const requestBody = {
      vcUid: config.vcUid,
      fields,
    };

    const issuanceDate = document.getElementById("issuance-date").value;
    const expiredDate = document.getElementById("expired-date").value;

    if (issuanceDate) requestBody.issuanceDate = issuanceDate;
    if (expiredDate) requestBody.expiredDate = expiredDate;

    const response = await fetch("/api/issuer/create-qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // 檢查是否有詳細的錯誤訊息（error 欄位）
      if (errorData.error) {
        const error = new Error("生成憑證失敗");
        error.error = errorData.error;
        throw error;
      }
      throw new Error(errorData.error || errorData.message || "生成憑證失敗");
    }

    const data = await response.json();

    // 儲存發行資訊，用於查詢時保存到資料庫
    currentIssuerInfo = {
      vcUid: config.vcUid,
      fields,
      issuanceDate: issuanceDate || undefined,
      expiredDate: expiredDate || undefined,
    };

    // 顯示彈窗
    document.getElementById("qr-code-image").src = data.qrCode;
    document.getElementById("qr-modal").style.display = "flex";
    document.getElementById("qr-status").textContent = "請使用數位憑證皮夾 APP 掃描此 QR Code";

    startPolling(data.transactionId);
  } catch (error) {
    console.error("Error generating certificate:", error);
    // 檢查是否有詳細的錯誤訊息
    if (error && error.error) {
      displayFormError(error.error);
    } else {
      showError(error.message || "生成憑證失敗");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="qr-code" class="w-5 h-5 mr-2"></i>生成憑證 QR Code';
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

function startPolling(transactionId) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  pollingInterval = setInterval(async () => {
    try {
      // 如果有發行資訊，使用 POST 請求傳遞資訊以便保存到資料庫
      const requestOptions = {
        method: currentIssuerInfo ? "POST" : "GET",
        headers: currentIssuerInfo ? { "Content-Type": "application/json" } : {},
        credentials: "include",
        body: currentIssuerInfo ? JSON.stringify(currentIssuerInfo) : undefined,
      };

      const response = await fetch(`/api/issuer/query-credential/${transactionId}`, requestOptions);

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
      statusEl.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 inline-block mr-2 text-green-600"></i>憑證發行成功！';
      document.getElementById("success-info").style.display = "block";
      document.getElementById("success-cid").textContent = data.cid || "N/A";
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      clearInterval(pollingInterval);
      currentIssuerInfo = null; // 清除發行資訊

      // 重新載入憑證列表
      void loadCertificates();

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
          }
        }, 1000);
      } else {
        // 如果找不到倒數元素，使用原來的 setTimeout
        setTimeout(() => {
          closeModal();
        }, 5000);
      }
    } catch (err) {
      console.error("Error polling credential:", err);
    }
  }, 5000);
}

// Tab 切換功能
function switchTab(tabName) {
  const tabIssue = document.getElementById("tab-issue");
  const tabList = document.getElementById("tab-list");
  const contentIssue = document.getElementById("tab-content-issue");
  const contentList = document.getElementById("tab-content-list");

  // 更新 Tab 按鈕樣式
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("text-blue-600", "border-b-2", "border-blue-600");
    btn.classList.add("text-slate-600");
  });

  if (tabName === "issue") {
    if (tabIssue) {
      tabIssue.classList.add("text-blue-600", "border-b-2", "border-blue-600");
      tabIssue.classList.remove("text-slate-600");
    }
    if (contentIssue) contentIssue.style.display = "block";
    if (contentList) contentList.style.display = "none";
  } else if (tabName === "list") {
    if (tabList) {
      tabList.classList.add("text-blue-600", "border-b-2", "border-blue-600");
      tabList.classList.remove("text-slate-600");
    }
    if (contentIssue) contentIssue.style.display = "none";
    if (contentList) contentList.style.display = "block";
    // 切換到列表時重新載入
    void loadCertificates();
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 載入憑證列表
async function loadCertificates() {
  const loadingEl = document.getElementById("certificates-loading");
  const emptyEl = document.getElementById("certificates-empty");
  const listEl = document.getElementById("certificates-list");

  loadingEl.style.display = "block";
  emptyEl.style.display = "none";
  listEl.innerHTML = "";

  try {
    const response = await fetch("/api/issuer/certificates", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("載入憑證列表失敗");
    }

    const certificates = await response.json();

    loadingEl.style.display = "none";

    if (certificates.length === 0) {
      emptyEl.style.display = "block";
      return;
    }

    // 顯示憑證列表
    certificates.forEach((cert) => {
      const certCard = createCertificateCard(cert);
      listEl.appendChild(certCard);
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (error) {
    console.error("Error loading certificates:", error);
    loadingEl.style.display = "none";
    listEl.innerHTML = `
      <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-red-600">載入失敗：${error.message}</p>
      </div>
    `;
  }
}

// 創建憑證卡片
function createCertificateCard(cert) {
  const card = document.createElement("div");
  card.className = "border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow";

  const statusBadge = cert.status === "REVOKED" 
    ? '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-semibold">已撤銷</span>'
    : '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-semibold">已發行</span>';

  const fieldsHtml = cert.fields.map(f => 
    `<div class="text-sm"><span class="font-medium">${f.ename}:</span> ${f.content}</div>`
  ).join("");

  const issuanceDate = cert.issuance_date || "未設定";
  const expiredDate = cert.expired_date || "未設定";
  const createdDate = cert.created_at ? new Date(cert.created_at * 1000).toLocaleString("zh-TW") : "未知";

  card.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <div>
        <h3 class="font-semibold text-lg text-slate-900">${cert.vc_uid}</h3>
        <p class="text-sm text-slate-500 mt-1">CID: ${cert.cid}</p>
      </div>
      ${statusBadge}
    </div>
    <div class="space-y-2 mb-4 text-slate-600">
      ${fieldsHtml}
    </div>
    <div class="grid grid-cols-2 gap-4 text-sm text-slate-600 mb-4">
      <div>
        <span class="font-medium">發行日期:</span> ${issuanceDate}
      </div>
      <div>
        <span class="font-medium">到期日期:</span> ${expiredDate}
      </div>
      <div class="col-span-2">
        <span class="font-medium">建立時間:</span> ${createdDate}
      </div>
    </div>
    ${cert.status === "ISSUED" ? `
      <div class="flex justify-end">
        <button class="revoke-btn inline-flex items-center justify-center rounded-md bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition-colors" data-cid="${cert.cid}">
          <i data-lucide="x-circle" class="w-4 h-4 mr-2"></i>
          撤銷憑證
        </button>
      </div>
    ` : ""}
  `;

  // 綁定撤銷按鈕事件
  const revokeBtn = card.querySelector(".revoke-btn");
  if (revokeBtn) {
    revokeBtn.addEventListener("click", () => revokeCertificate(cert.cid));
  }

  return card;
}

// 撤銷憑證
async function revokeCertificate(cid) {
  if (!confirm("確定要撤銷此憑證嗎？此操作無法復原。")) {
    return;
  }

  try {
    const response = await fetch(`/api/issuer/revoke-credential/${cid}`, {
      method: "PUT",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "撤銷憑證失敗");
    }

    const data = await response.json();
    alert(`憑證已撤銷：${data.credentialStatus}`);
    
    // 重新載入憑證列表
    void loadCertificates();
  } catch (error) {
    console.error("Error revoking credential:", error);
    alert(`撤銷失敗：${error.message}`);
  }
}

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

function resetForm() {
  document.getElementById("certificate-type").value = "liquid_finance_certificate";
  handleCertificateTypeChange();
  document
    .getElementById("dynamic-fields")
    .querySelectorAll("input")
    .forEach((input) => (input.value = ""));
  setDefaultDates();
  hideError();
  currentIssuerInfo = null;
  closeModal();
}

function showError(message) {
  const errorDiv = document.getElementById("error-message");
  const errorDetailsDiv = errorDiv?.querySelector(".error-details");
  
  if (errorDiv && errorDetailsDiv) {
    errorDetailsDiv.innerHTML = `<div class="error-item"><span class="error-reason">${message}</span></div>`;
    errorDiv.style.display = "block";
    errorDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else if (errorDiv) {
    // 如果結構不存在，使用簡單顯示
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }
}

function hideError() {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    const errorDetailsDiv = errorDiv.querySelector(".error-details");
    if (errorDetailsDiv) {
      errorDetailsDiv.innerHTML = "";
    }
    errorDiv.style.display = "none";
  }
}

// 顯示表單錯誤訊息（解析詳細的錯誤格式）
function displayFormError(errorData) {
  const errorDiv = document.getElementById("error-message");
  const errorDetailsDiv = errorDiv.querySelector(".error-details");
  
  if (!errorDiv || !errorDetailsDiv) {
    // 如果結構不存在，使用簡單顯示
    if (errorDiv) {
      errorDiv.textContent = "生成憑證失敗";
      errorDiv.style.display = "block";
    }
    return;
  }
  
  let errorDetailsHTML = "";
  
  try {
    // 解析錯誤訊息（可能是 JSON 字串）
    let errorArray;
    if (typeof errorData === "string") {
      errorArray = JSON.parse(errorData);
    } else {
      errorArray = errorData;
    }
    
    if (Array.isArray(errorArray) && errorArray.length > 0) {
      errorDetailsHTML = errorArray.map((error) => {
        const fieldName = error.cname || error.ename || "欄位";
        const invalidReasons = Array.isArray(error.invalid) 
          ? error.invalid.join("、") 
          : error.invalid || "驗證失敗";
        return `
          <div class="flex items-start gap-3 p-3 bg-white rounded-lg border-l-4 border-red-500 mb-2">
            <span class="font-semibold text-slate-900 min-w-20 flex-shrink-0">${fieldName}</span>
            <span class="text-red-600 flex-1">${invalidReasons}</span>
          </div>
        `;
      }).join("");
    } else {
      errorDetailsHTML = `<div class="flex items-start gap-3 p-3 bg-white rounded-lg border-l-4 border-red-500 mb-2"><span class="text-red-600 flex-1">${typeof errorData === "string" ? errorData : "驗證失敗"}</span></div>`;
    }
  } catch (e) {
    console.error("Error parsing error message:", e);
    errorDetailsHTML = `<div class="flex items-start gap-3 p-3 bg-white rounded-lg border-l-4 border-red-500 mb-2"><span class="text-red-600 flex-1">${typeof errorData === "string" ? errorData : "驗證失敗"}</span></div>`;
  }
  
  // 更新錯誤詳情
  errorDetailsDiv.innerHTML = errorDetailsHTML;
  
  // 顯示錯誤訊息區域
  errorDiv.style.display = "block";
  
  // 滾動到錯誤訊息區域
  errorDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

