"use client";
import { colorFor, initials, type User } from "@/lib/client";

type P = Pick<User, "id" | "name"> & { avatarAt?: string | null };

/** Profile photo when the person uploaded one, otherwise their initials on a stable color. */
export function Avatar({ user, size, className = "av" }: { user?: P | null; size?: "lg" | "xl"; className?: string }) {
  if (!user) return <span className="nobody" />;
  if (user.avatarAt) {
    return <img className={`${className} ${size ?? ""} photo`} src={`/api/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarAt)}`} alt="" title={user.name} />;
  }
  return (
    <span className={`${className} ${size ?? ""}`} style={{ background: colorFor(user.id) }} title={user.name}>
      {initials(user.name)}
    </span>
  );
}
