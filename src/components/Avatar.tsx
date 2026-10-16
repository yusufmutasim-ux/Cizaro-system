"use client";
import { colorFor, initials, type User } from "@/lib/client";

export function Avatar({ user, size, className = "av" }: { user?: User | null; size?: "lg"; className?: string }) {
  if (!user) return <span className="nobody" title="مش متعيّن" />;
  return (
    <span className={`${className} ${size ?? ""}`} style={{ background: colorFor(user.id) }} title={user.name}>
      {initials(user.name)}
    </span>
  );
}
