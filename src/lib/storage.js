import { safeJsonParse } from "./utils.js";

const FAVORITES_KEY = "pixpdf-favorites";
const THEME_KEY = "pixpdf-theme";

export function getFavorites() {
  try {
    const value = safeJsonParse(localStorage.getItem(FAVORITES_KEY), []);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function isFavorite(slug) {
  return getFavorites().includes(slug);
}

export function toggleFavorite(slug) {
  const favorites = getFavorites();
  const next = favorites.includes(slug)
    ? favorites.filter((item) => item !== slug)
    : [slug, ...favorites].slice(0, 24);
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    /* storage can be unavailable in private mode */
  }
  return next.includes(slug);
}

export function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#0c0b16" : "#f7f6ff");
  window.dispatchEvent(new CustomEvent("pixpdf:theme", { detail: next }));
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function getRecent() {
  try {
    const value = safeJsonParse(localStorage.getItem("pixpdf-recent"), []);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function addRecent(slug) {
  try {
    const next = [slug, ...getRecent().filter((item) => item !== slug)].slice(0, 6);
    localStorage.setItem("pixpdf-recent", JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
