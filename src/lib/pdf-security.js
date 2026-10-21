export function stripStaleEncryption(doc) {
  const context = doc.context;
  const decoder = new TextDecoder();
  for (const [ref, object] of [...context.indirectObjects]) {
    const data = object?.data;
    if (!(data instanceof Uint8Array)) continue;
    const head = decoder.decode(data.subarray(0, 1024));
    if (/\/Type\s*\/XRef/.test(head)) context.delete(ref);
  }
  if (context.trailerInfo.Encrypt) delete context.trailerInfo.Encrypt;
  if (context.security) delete context.security;
  return doc;
}
