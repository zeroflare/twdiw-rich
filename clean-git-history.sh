#!/bin/bash

# Git 歷史清理腳本
# 此腳本會保留到 "Fix error" (34f42e0) 提交的歷史，刪除之後的所有提交
# ⚠️ 警告：這會永久刪除指定提交之後的所有歷史記錄

set -e

TARGET_COMMIT="34f42e0"  # Fix error 提交

echo "⚠️  警告：此操作會永久刪除指定提交之後的所有 Git 歷史記錄！"
echo ""
echo "此腳本會："
echo "1. 保留到 'Fix error' ($TARGET_COMMIT) 提交的歷史"
echo "2. 刪除該提交之後的所有提交（共 12 個提交）"
echo "3. 將當前工作目錄的狀態作為新提交"
echo ""
echo "將被刪除的提交："
git log --oneline ${TARGET_COMMIT}..HEAD 2>/dev/null || echo "   (無)"
echo ""
echo "執行後，你需要："
echo "- 強制推送到遠程倉庫：git push origin main --force"
echo "- 通知所有協作者更新本地分支"
echo ""
read -p "確定要繼續嗎？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 1
fi

# 檢查目標提交是否存在
if ! git rev-parse --verify ${TARGET_COMMIT} >/dev/null 2>&1; then
    echo "❌ 錯誤：找不到提交 $TARGET_COMMIT"
    exit 1
fi

# 備份當前分支名稱
CURRENT_BRANCH=$(git branch --show-current)
echo "當前分支：$CURRENT_BRANCH"

# 創建臨時分支來備份當前狀態
BACKUP_BRANCH="backup-before-clean-$(date +%s)"
echo "創建備份分支：$BACKUP_BRANCH"
git branch $BACKUP_BRANCH

# 暫存當前所有更改（包括未追蹤的文件）
echo "暫存當前所有更改..."
git add -A

# 如果有未提交的更改，先提交以保存狀態
if [ -n "$(git status --porcelain)" ]; then
    echo "創建臨時提交以保存當前狀態..."
    git commit -m "TEMP: Save current state before reset" || true
fi

# 重置到目標提交（使用 --soft 保留所有更改在暫存區）
echo "重置到提交 $TARGET_COMMIT (Fix error)..."
git reset --soft ${TARGET_COMMIT}

# 現在所有更改都在暫存區，創建新提交
echo "添加當前所有文件..."
git add -A

if [ -n "$(git diff --cached --name-only)" ]; then
    echo "創建新提交包含當前狀態..."
    git commit -m "Clean history: preserve code state after removing sensitive commits"
else
    echo "⚠️  警告：沒有更改需要提交，歷史已重置到 $TARGET_COMMIT"
fi

echo ""
echo "備份分支已創建：$BACKUP_BRANCH"
echo "如果需要恢復，可以執行：git reset --hard $BACKUP_BRANCH"

echo ""
echo "✅ Git 歷史清理完成！"
echo ""
echo "下一步操作："
echo "1. 檢查新的提交：git log"
echo "2. 強制推送到遠程（⚠️ 這會覆蓋遠程歷史）："
echo "   git push origin main --force"
echo ""
echo "⚠️  重要提醒："
echo "- 所有協作者需要重新克隆倉庫或執行："
echo "  git fetch origin"
echo "  git reset --hard origin/main"
echo "- 如果 GitHub 上有 token 洩露，請立即在 GitHub 設置中撤銷該 token"
echo "- 考慮使用 GitHub 的 secret scanning 功能檢查是否還有其他洩露"

