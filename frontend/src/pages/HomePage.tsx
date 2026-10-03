import { useLocation } from "react-router-dom";

import { useAuth } from "../auth/context";
import { SystemStatus } from "../components/SystemStatus";
import { Alert } from "../components/ui";

/** Administrator home page. Doctors get the dashboard instead (see IndexPage). */
export function HomePage() {
  const { user } = useAuth();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-lg bg-white p-6 shadow-sm md:col-span-2">
          <h1 className="text-2xl font-bold text-brand-700">Welcome, {user?.full_name}</h1>
          <p className="mt-3 text-slate-700">
            CaviNet helps doctors estimate whether a chest CT scan of a patient with suspected
            mycobacterial lung disease looks more like <strong>tuberculosis (TB)</strong> or{" "}
            <strong>non-tuberculous mycobacterial (NTM) disease</strong>, together with a calibrated
            confidence score.
          </p>
          <p className="mt-3 text-slate-700">
            Use Users to manage accounts and Audit log to review activity. Administrators have no
            access to patient records.
          </p>
        </section>
        <SystemStatus />
      </div>
    </div>
  );
}
