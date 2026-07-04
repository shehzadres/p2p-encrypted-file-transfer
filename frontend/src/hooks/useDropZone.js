import { useState, useCallback, useRef } from 'react';

/**
 * Returns drag-and-drop props + file input helpers.
 * Supports files and folders (webkitdirectory).
 */
export function useDropZone({ onFiles, disabled = false } = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef(null);

  const processEntries = useCallback(async (items) => {
    const files = [];
    await Promise.all(
      [...items].map((item) => {
        const entry = item.webkitGetAsEntry?.();
        if (entry) return collectFiles(entry, files);
        const f = item.getAsFile?.();
        if (f) files.push(f);
        return Promise.resolve();
      })
    );
    return files;
  }, []);

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    if (disabled) return;
    dragCounter.current++;
    setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(async (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (disabled) return;

    const files = await processEntries(e.dataTransfer.items);
    if (files.length > 0) onFiles?.(files);
  }, [disabled, processEntries, onFiles]);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onInputChange = useCallback((e) => {
    const files = [...(e.target.files || [])];
    if (files.length > 0) onFiles?.(files);
    e.target.value = '';
  }, [onFiles]);

  return {
    isDragging,
    dropZoneProps: { onDragEnter, onDragLeave, onDragOver, onDrop },
    inputRef,
    openPicker,
    onInputChange,
  };
}

/**
 * Recursively collect all File objects from a FileSystemEntry.
 */
async function collectFiles(entry, results) {
  if (entry.isFile) {
    const file = await readFile(entry);
    results.push(file);
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries = await readAllEntries(reader);
    await Promise.all(entries.map((e) => collectFiles(e, results)));
  }
}

const readFile = (entry) =>
  new Promise((resolve, reject) => entry.file(resolve, reject));

const readAllEntries = (reader) =>
  new Promise((resolve, reject) => {
    const all = [];
    const batch = () => {
      reader.readEntries((entries) => {
        if (!entries.length) return resolve(all);
        all.push(...entries);
        batch();
      }, reject);
    };
    batch();
  });
