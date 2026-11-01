import { Icon, type IconName } from "./ui";
import { go } from "../lib/router";

const TABS: { key: string; label: string; icon: IconName; href: string; match: (p: string[]) => boolean }[] = [
  { key: "home", label: "בית", icon: "home", href: "/", match: (p) => p.length === 0 || ["checkin", "review", "week"].includes(p[0]) },
  { key: "train", label: "אימון", icon: "train", href: "/train", match: (p) => p[0] === "train" },
  { key: "coach", label: "מאמן", icon: "coach", href: "/coach", match: (p) => p[0] === "coach" },
  { key: "track", label: "מעקב", icon: "track", href: "/track", match: (p) => p[0] === "track" || p[0] === "habits" },
  { key: "profile", label: "פרופיל", icon: "profile", href: "/profile", match: (p) => p[0] === "profile" },
];

export function TabBar({ path }: { path: string[] }) {
  return (
    <nav className="tabbar" aria-label="ניווט ראשי">
      {TABS.map((t) => {
        const active = t.match(path);
        return (
          <button
            key={t.key}
            className="tab"
            aria-current={active ? "page" : undefined}
            onClick={() => go(t.href)}
          >
            <span className="tab-icon"><Icon name={t.icon} /></span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
