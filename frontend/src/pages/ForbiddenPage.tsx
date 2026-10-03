import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-800">No access</h1>
      <p className="mt-3 text-slate-600">
        Your account does not have permission to view this page.
      </p>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Go to the home page
      </Link>
    </section>
  );
}
