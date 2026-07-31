import { useEffect, useState } from "react";

export type Mode = "dark" | "light";
export type Accent = "gold" | "green" | "blue" | "orange" | "yellow" | "purple";

const MODE_KEY = "sf.theme.mode";
const ACCENT_KEY = "sf.theme.accent";

const ACCENTS: Record<Accent, { primary: string; ring: string; sidebarPrimary: string }> = {
  gold:   { primary: "oklch(0.76 0.11 82)",  ring: "oklch(0.76 0.11 82)",  sidebarPrimary: "oklch(0.76 0.11 82)"  },
  green:  { primary: "oklch(0.72 0.18 148)", ring: "oklch(0.72 0.18 148)", sidebarPrimary: "oklch(0.72 0.18 148)" },
  blue:   { primary: "oklch(0.68 0.17 245)", ring: "oklch(0.68 0.17 245)", sidebarPrimary: "oklch(0.68 0.17 245)" },
  orange: { primary: "oklch(0.72 0.19 55)",  ring: "oklch(0.72 0.19 55)",  sidebarPrimary: "oklch(0.72 0.19 55)"  },
  yellow: { primary: "oklch(0.82 0.17 90)",  ring: "oklch(0.82 0.17 90)",  sidebarPrimary: "oklch(0.82 0.17 90)"  },
  purple: { primary: "oklch(0.68 0.2 300)",  ring: "oklch(0.68 0.2 300)",  sidebarPrimary: "oklch(0.68 0.2 300)"  },
};

export function applyTheme(mode: Mode, accent: Accent) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.style.colorScheme = mode;
  const a = ACCENTS[accent] ?? ACCENTS.gold;
  root.style.setProperty("--primary", a.primary);
  root.style.setProperty("--ring", a.ring);
  root.style.setProperty("--sidebar-primary", a.sidebarPrimary);
  root.style.setProperty("--sidebar-ring", a.ring);
  // Verde permanece reservado a lucro/valores positivos — não segue o accent.
  root.style.setProperty("--chart-1", a.primary);
}

/** Remove qualquer override de accent, voltando aos tokens do design system. */
export function resetThemeOverrides() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const p of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--success", "--chart-1"]) {
    root.style.removeProperty(p);
  }
}

export function getStoredTheme(): { mode: Mode; accent: Accent } {
  if (typeof window === "undefined") return { mode: "dark", accent: "gold" };
  const mode = (localStorage.getItem(MODE_KEY) as Mode) || "dark";
  const accent = (localStorage.getItem(ACCENT_KEY) as Accent) || "gold";
  return { mode, accent: ACCENTS[accent] ? accent : "gold" };
}

export function useTheme() {
  const [mode, setModeState] = useState<Mode>("dark");
  const [accent, setAccentState] = useState<Accent>("gold");

  useEffect(() => {
    const s = getStoredTheme();
    setModeState(s.mode);
    setAccentState(s.accent);
    applyTheme(s.mode, s.accent);
  }, []);

  function setMode(m: Mode) {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
    applyTheme(m, accent);
  }
  function setAccent(a: Accent) {
    setAccentState(a);
    localStorage.setItem(ACCENT_KEY, a);
    applyTheme(mode, a);
  }
  return { mode, accent, setMode, setAccent };
}
