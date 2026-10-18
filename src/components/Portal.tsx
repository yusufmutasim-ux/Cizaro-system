"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renders overlays (sheets, toasts) on <body>, so page animations can never trap or offset them. */
export function Portal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}
