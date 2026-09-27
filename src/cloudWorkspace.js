const API = import.meta.env.VITE_TOOLLOOT_API || "";

export const accountKey = "toolloot:account";
export const getAccount = () => {
  try { return JSON.parse(localStorage.getItem(accountKey) || "null"); } catch { return null; }
};
export const saveAccount = v => localStorage.setItem(accountKey, JSON.stringify(v));

export async function api(path, options = {}) {
  const account = getAccount();
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (account?.token) headers.authorization = "Bearer " + account.token;
  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const cloudEnabled = () => !!API;
