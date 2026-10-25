export async function collectBatch(files, task) {
  const outputs = [];
  const warnings = [];
  const notes = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      const result = await task(file, index);
      const items = Array.isArray(result) ? result : result ? [result] : [];
      for (const item of items) {
        outputs.push(item);
        if (Array.isArray(item?.notes)) notes.push(...item.notes);
      }
    } catch (error) {
      warnings.push({
        name: file?.name || `File ${index + 1}`,
        message: error?.message || "This file could not be processed."
      });
    }
  }

  outputs.warnings = warnings;
  outputs.notes = notes;
  if (!outputs.length && warnings.length) {
    const error = new Error(
      files.length === 1
        ? warnings[0].message
        : `None of the ${files.length} files could be processed. ${warnings[0].message}`
    );
    error.warnings = warnings;
    throw error;
  }
  return outputs;
}
