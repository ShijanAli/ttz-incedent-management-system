/**
 * Remembers the last project each user worked on in the issues page, so the board
 * opens on it next time. Local storage keeps it across tabs and restarts, keyed per
 * user so a shared browser doesn't hand one account's project to another.
 */
const keyFor = (userId: string | number) => `ttz:last-board-project:${userId}`;

export function rememberBoardProject(userId: string | number, projectId: string) {
  try {
    localStorage.setItem(keyFor(userId), projectId);
  } catch {
    // Storage blocked; the board just falls back to the first project
  }
}

export function lastBoardProject(userId: string | number): string | null {
  try {
    return localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}
