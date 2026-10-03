import { useAuth } from "../auth/context";
import { DashboardPage } from "./DashboardPage";
import { HomePage } from "./HomePage";

/** "/" is the dashboard for doctors (M-02) and the home page for administrators. */
export function IndexPage() {
  const { user } = useAuth();
  return user?.role === "doctor" ? <DashboardPage /> : <HomePage />;
}
