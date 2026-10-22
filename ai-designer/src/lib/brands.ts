import type { Brand, BrandFile } from "@prisma/client";
import { parseBook } from "./brand";

export const fileDTO = (f: BrandFile) => ({ id: f.id, kind: f.kind, name: f.name, mime: f.mime, size: f.size, url: `/api/files/${f.id}`, createdAt: f.createdAt.toISOString() });
export type FileDTO = ReturnType<typeof fileDTO>;

export function brandDTO(b: Brand & { files?: BrandFile[]; _count?: { designs: number; campaigns: number } }) {
  const logo = b.files?.find((f) => f.kind === "logo" && f.mime.startsWith("image/"));
  return { id: b.id, name: b.name, color: b.color, book: parseBook(b.book), logo: logo ? `/api/files/${logo.id}` : null, designs: b._count?.designs ?? 0, campaigns: b._count?.campaigns ?? 0 };
}
export type BrandDTO = ReturnType<typeof brandDTO>;
