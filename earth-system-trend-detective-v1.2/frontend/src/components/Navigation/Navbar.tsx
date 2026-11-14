import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe2, Menu, ShieldAlert, Sparkles, TrendingUp, X } from "lucide-react";
import { useSelectedLocation } from "../../context/LocationContext";
import { investigateUrl } from "../../utils/geo";

const linkBase = "flex items-center gap-1.5 text-sm font-medium transition-colors";

export const Navbar: React.FC = () => {
  const { pathname } = useLocation();
  const { location } = useSelectedLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  const items = [
    { to: "/", label: "Globe", icon: <Globe2 className="h-4 w-4" /> },
    {
      to: location ? investigateUrl(location) : "/investigate",
      match: "/investigate",
      label: "Trend Analyser",
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      to: "/environmental",
      label: "Environmental Challenges",
      icon: <ShieldAlert className="h-4 w-4" />,
    },
  ];

  const isActive = (item: { to: string; match?: string }) => pathname === (item.match ?? item.to);
  const linkClass = (active: boolean) =>
    `${linkBase} ${active ? "text-cyan-400" : "text-slate-300 hover:text-white"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-900/40 bg-[#050811]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-lg shadow-cyan-500/20">
            <Globe2 className="h-6 w-6 animate-spin-slow text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-wide text-white">
              Earth System Trend Detective
            </span>
            <span className="block font-mono text-xs text-cyan-400">NASA Space Apps Challenge</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {items.map((item) => (
            <Link key={item.label} to={item.to} className={linkClass(isActive(item))}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-cyan-800/50 bg-cyan-950/60 px-3 py-1.5 font-mono text-xs text-cyan-300 lg:flex">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>NASA POWER / MERRA-2</span>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="space-y-4 border-t border-slate-800 bg-[#050811] px-4 py-4 md:hidden">
          {items.map((item) => (
            <Link key={item.label} to={item.to} className={linkClass(isActive(item))}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};
