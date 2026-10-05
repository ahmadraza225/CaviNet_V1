import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

/** Shown instead of a blank or technical screen if a page fails unexpectedly. */
export function ErrorPage() {
  const error = useRouteError();
  // Keep the technical detail for developers (browser console), not on screen.
  console.error(error);
  const status = isRouteErrorResponse(error) ? ` (${error.status})` : "";
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section role="alert" className="max-w-lg rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Something went wrong{status}</h1>
        <p className="mt-3 text-slate-600">
          This page could not be shown. Your data is safe: nothing was changed. Reload the page to
          try again; if the problem continues, tell your administrator what you were doing.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Reload the page
          </button>
          <Link
            to="/"
            reloadDocument
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to the start page
          </Link>
        </div>
      </section>
    </div>
  );
}
