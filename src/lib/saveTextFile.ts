import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from './nativeLayout';

const nativeLayout = registerPlugin<{ saveTextFile(options: { filename: string; mimeType: string; content: string }): Promise<void> }>('NativeLayout');
export async function saveTextFile(content: string, filename: string, mimeType: string) {
  filename = filename.replace(/[\\/:*?"<>|]/g, '_');
  if (isAndroidApp) {
    await nativeLayout.saveTextFile({ content, filename, mimeType });
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Keep the URL alive until the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
