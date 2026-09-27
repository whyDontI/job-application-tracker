export function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:999999;background:#202124;color:#fff;padding:8px 14px;border-radius:6px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.2);";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
