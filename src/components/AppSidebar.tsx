"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileUp,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/study", label: "Study Workspace", icon: BookOpen },
  { href: "/planner", label: "Daily Planner", icon: CalendarDays },
  { href: "/sessions", label: "Study Timer", icon: Clock3 },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
];

const manageItems = [
  { href: "/manage", label: "Years & Semesters", icon: GraduationCap, small: true },
  { href: "/manage/courses", label: "Courses", icon: FolderKanban, small: true },
  { href: "/manage/curriculum", label: "Curriculum", icon: ClipboardList, small: true },
  { href: "/manage/resources", label: "Resources", icon: BookOpen, small: true },
  { href: "/manage/import-export", label: "Import / Export", icon: FileUp, small: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <aside
      className={[
        "relative flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/90 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-20" : "w-72",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-4">
        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-full opacity-100"}`}>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Study OS</h1>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800/80 text-sm text-slate-200 transition-colors hover:bg-slate-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300 shadow-sm shadow-blue-500/10"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/70",
                collapsed ? "justify-center px-0" : "justify-start",
              ].join(" ")}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} strokeWidth={1.8} aria-hidden="true" className={collapsed ? undefined : "mr-3 shrink-0"} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {!collapsed && (
          <div className="pt-5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Manage</p>
          </div>
        )}

        {manageItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center rounded-xl border px-3 py-2 text-sm transition-all duration-200",
                active
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/70",
                collapsed ? "justify-center px-0" : item.small ? "justify-start" : "justify-start",
              ].join(" ")}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={17} strokeWidth={1.8} aria-hidden="true" className={collapsed ? undefined : "mr-3 shrink-0"} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
