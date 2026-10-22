"use client";
import { createContext, useContext } from "react";
import type { BrandDTO, FileDTO } from "@/lib/client";

export type Ready = { claude: boolean; mcp: boolean; publicUrl: boolean };
type Ctx = { brand: BrandDTO; files: FileDTO[]; reloadFiles: () => Promise<void>; updateBrand: (b: BrandDTO) => void; ready: Ready; say: (m: string) => void };
export const BrandCtx = createContext<Ctx | null>(null);
export const useBrand = () => useContext(BrandCtx)!;
