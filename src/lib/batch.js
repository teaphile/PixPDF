export async function collectBatch(files, task) {
  const outputs = [];
  const warnings = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      const result = await task(file, index);
      if (Array.isArray(result)) outputs.push(...result);
      else if (result) outputs.push(result);
    } catch (error) {
      warnings.push({
        name: file?.name || `File ${index + 1}`,
        message: error?.message || "This file could not be processed."
      });
    }
  }

  outputs.warnings = warnings;
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
