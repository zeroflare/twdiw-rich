/* eslint-env browser */
// Home Page JavaScript
document.addEventListener("DOMContentLoaded", () => {
  void loadUserInfo();
  // Initialize Lucide icons after DOM updates
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// 載入使用者資訊（如果已登入）
async function loadUserInfo() {
  try {
    const response = await fetch("/api/user", { credentials: "include" });
    
    // 檢查是否被重定向到登入頁面
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      // 未登入，顯示登入按鈕
      showLoginButton();
      return;
    }
    
    if (response.status === 401) {
      // 未登入，顯示登入按鈕
      showLoginButton();
      return;
    }
    
    if (response.ok) {
      // 已登入，顯示用戶資訊和登出按鈕
      const user = await response.json();
      document.getElementById("user-name").textContent = user.name || user.email || "使用者";
      document.getElementById("user-email").textContent = user.email || "";
      document.getElementById("user-info").style.display = "flex";
      document.getElementById("login-link").style.display = "none";
      document.getElementById("logout-link").style.display = "block";
      // Refresh Lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  } catch (error) {
    console.error("Error loading user info:", error);
    // 發生錯誤時，顯示登入按鈕
    showLoginButton();
  }
}

// 顯示登入按鈕（隱藏用戶資訊和登出按鈕）
function showLoginButton() {
  document.getElementById("user-info").style.display = "none";
  document.getElementById("login-link").style.display = "block";
  document.getElementById("logout-link").style.display = "none";
  // Refresh Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

