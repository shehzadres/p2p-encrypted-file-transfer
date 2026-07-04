import { clsx } from 'clsx';

export { clsx as cn };

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format transfer speed
 */
export function formatSpeed(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format remaining time
 */
export function formatETA(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * Get file type icon category
 */
export function getFileCategory(mimeType = '', name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  if (/image\//.test(mimeType)) return 'image';
  if (/video\//.test(mimeType)) return 'video';
  if (/audio\//.test(mimeType)) return 'audio';
  if (/pdf/.test(mimeType) || ext === 'pdf') return 'pdf';
  if (/zip|tar|gz|rar|7z/.test(ext)) return 'archive';
  if (/doc|docx|odt/.test(ext)) return 'document';
  if (/xls|xlsx|csv/.test(ext)) return 'spreadsheet';
  if (/ppt|pptx/.test(ext)) return 'presentation';
  if (/js|ts|jsx|tsx|py|java|go|rs|c|cpp|html|css|json|yaml|md/.test(ext)) return 'code';
  return 'file';
}

/**
 * Generate a short room link
 */
export function buildRoomUrl(roomId) {
  return `${window.location.origin}/receive/${roomId}`;
}

/**
 * Debounce a function
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Sleep utility for async flows
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
