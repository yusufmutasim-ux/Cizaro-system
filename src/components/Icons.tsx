// SF Symbols-style line icons, drawn once as a sprite and referenced with <I name="..." />
export type IconName = "plus" | "search" | "cal" | "today" | "clock" | "eye" | "person" | "flag" | "tag" | "ruler" | "circle" | "clip" | "photo" | "doc" | "film" | "link" | "check" | "x" | "up" | "redo" | "tray" | "warn" | "trash" | "list";

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
    <symbol id="cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
    <symbol id="today" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/></symbol>
    <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
    <symbol id="eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="person" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></symbol>
    <symbol id="flag" viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></symbol>
    <symbol id="tag" viewBox="0 0 24 24"><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z"/><circle cx="8.5" cy="8.5" r="1.4"/></symbol>
    <symbol id="ruler" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7 7v4M11 7v3M15 7v4M19 7v3"/></symbol>
    <symbol id="circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor"/></symbol>
    <symbol id="clip" viewBox="0 0 24 24"><path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7"/></symbol>
    <symbol id="photo" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8.5"/></symbol>
    <symbol id="doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></symbol>
    <symbol id="film" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></symbol>
    <symbol id="link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
    <symbol id="check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
    <symbol id="x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
    <symbol id="up" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></symbol>
    <symbol id="redo" viewBox="0 0 24 24"><path d="M20 8h-9a6 6 0 0 0 0 12h3"/><path d="m16 4 4 4-4 4"/></symbol>
    <symbol id="tray" viewBox="0 0 24 24"><path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"/></symbol>
    <symbol id="warn" viewBox="0 0 24 24"><path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17.2v.1"/></symbol>
    <symbol id="trash" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></symbol>
    <symbol id="list" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></symbol>
    </svg>
  );
}

export function I({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={`i ${className}`} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}
