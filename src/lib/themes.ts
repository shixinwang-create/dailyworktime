const DARK_MODE_KEY = "time_tracker_dark_mode";

export function isDarkMode(): boolean {
  const saved = localStorage.getItem(DARK_MODE_KEY);
  if (saved !== null) return saved === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function saveDarkMode(dark: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, dark.toString());
}

export function applyDarkMode(dark: boolean): void {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
