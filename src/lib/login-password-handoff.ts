/**
 * Hands the password the user just typed on the login page to the forced
 * change-password page, so they don't have to type it again as "current password".
 * Memory only: it's gone on reload, and the page then falls back to asking for it.
 */
let pendingPassword: string | null = null;

export function setLoginPassword(password: string) {
  pendingPassword = password;
}

export function peekLoginPassword(): string | null {
  return pendingPassword;
}

export function clearLoginPassword() {
  pendingPassword = null;
}
