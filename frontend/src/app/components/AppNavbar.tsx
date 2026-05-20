import type { ActiveTab } from "../types";

type AppNavbarProps = {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
};

const navItems: { id: ActiveTab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "past", label: "Past Uploads" },
];

export function AppNavbar({ activeTab, onTabChange }: AppNavbarProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-zinc-800 bg-black/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => onTabChange("upload")}
          className="text-left text-sm font-semibold tracking-tight text-white"
        >
          Image Labels Generator
        </button>

        <div className="flex rounded-full border border-zinc-800 bg-zinc-950 p-1 text-sm">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`rounded-full px-4 py-2 transition ${
                activeTab === item.id
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
