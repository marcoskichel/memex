export function formatContext(files: string[]): string {
  if (files.length === 0) {
    return '';
  }
  return files.join('\n\n---\n\n');
}
