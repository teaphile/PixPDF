import JSZip from "jszip";

export async function zipOutputs(outputs, filename = "pixpdf-results.zip") {
  const zip = new JSZip();
  const used = new Set();
  for (const output of outputs) {
    let name = output.name;
    let count = 2;
    while (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name =
        dot > 0
          ? `${name.slice(0, dot)}-${count}${name.slice(dot)}`
          : `${name}-${count}`;
      count += 1;
    }
    used.add(name);
    zip.file(name, output.blob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, name: filename };
}

export async function makeZip(files, filename = "pixpdf-results.zip") {
  const zip = new JSZip();
  files.forEach((file) => zip.file(file.name, file.blob || file));
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, name: filename };
}
