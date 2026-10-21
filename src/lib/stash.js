let pendingFiles = [];

export function stashFiles(files) {
  pendingFiles = Array.from(files || []);
}

export function takeStashedFiles() {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}

export function hasStashedFiles() {
  return pendingFiles.length > 0;
}
