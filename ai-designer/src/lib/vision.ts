import sharp from "sharp";

/** Shrinks an image to what Claude's vision uses (long edge 1568px) as JPEG. Deterministic for the same input. */
export async function forVision(buf: Buffer) {
  const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
  return out.toString("base64");
}
