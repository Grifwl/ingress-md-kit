/**
 * Saving generated files from the browser.
 */

/**
 * Offers a generated file to the organiser as a download.
 *
 * @param content - Contents of the file.
 * @param name - Suggested file name.
 * @param type - MIME type.
 */
export function downloadFile(content: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
