// Per-device settings that never leave the browser. Storage can throw (private mode,
// blocked site data), so every access is guarded and the app works without it.

const APP_TOKEN = "app-access-token";

export function getAppToken(): string {
  try {
    return localStorage.getItem(APP_TOKEN) ?? "";
  } catch {
    return "";
  }
}

export function setAppToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(APP_TOKEN, token.trim());
    else localStorage.removeItem(APP_TOKEN);
  } catch {
    // Not persisted; the photo request will ask again.
  }
}
