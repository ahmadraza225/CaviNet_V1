import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/context";
import { DISCLAIMER, NAV_ITEMS, ROLE_LABELS } from "../navigation";

export function Layout() {
  const { user, signOut } = useAuth();
  const items = user ? NAV_ITEMS.filter((item) => item.roles.includes(user.role)) : [];
  const showNav = user && !user.must_change_password;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand-700 text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="text-xl font-bold tracking-wide">
              CaviNet
            </NavLink>
            {showNav && (
              <nav aria-label="Main navigation" className="flex gap-6 text-sm">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      isActive ? "font-semibold underline" : "opacity-90 hover:opacity-100"
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span>
                <span className="font-medium">{user.full_name}</span>{" "}
                <span className="rounded bg-brand-800 px-2 py-0.5 text-xs">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
              {showNav && (
                <NavLink to="/change-password" className="opacity-90 hover:opacity-100">
                  Change password
                </NavLink>
              )}
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded border border-white/40 px-3 py-1 hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          )}
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
