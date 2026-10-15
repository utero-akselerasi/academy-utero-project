import { fileTypeFromBuffer } from "file-type";

export async function verifyContentType(sample, declaredMime) {
  const detected = await fileTypeFromBuffer(sample);
  if (declaredMime === "text/plain") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(sample);
      return !detected && !sample.includes(0);
    } catch {
      return false;
    }
  }
  if (declaredMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return detected?.mime === "application/zip" || detected?.mime === declaredMime;
  }
  return detected?.mime === declaredMime;
}
