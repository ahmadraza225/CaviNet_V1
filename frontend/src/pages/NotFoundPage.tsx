import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-800">Page not found</h1>
      <p className="mt-3 text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Go to the home page
      </Link>
    </section>
  );
}
