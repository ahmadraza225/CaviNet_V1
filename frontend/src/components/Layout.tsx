import { NavLink, Outlet } from "react-router-dom";

export const DISCLAIMER = "Decision support only. Not a diagnosis. Confirm with laboratory tests.";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand-700 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="text-xl font-bold tracking-wide">
            CaviNet
          </NavLink>
          <nav aria-label="Main navigation" className="flex gap-6 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "font-semibold underline" : "opacity-90")}
            >
              Home
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-500">
          <p>{DISCLAIMER}</p>
          <p className="mt-1">
            CaviNet research prototype · Air University Islamabad · FYP 2025–2027
          </p>
        </div>
      </footer>
    </div>
  );
}
