// src/lib/token.js
export function getCleanToken() {
  const raw =
    localStorage.getItem("vm_token") ||
    localStorage.getItem("fluxum_token") ||
    localStorage.getItem("access_token") ||
    "";
  return raw.trim().replace(/^['"<]+|['">]+$/g, "");
}
