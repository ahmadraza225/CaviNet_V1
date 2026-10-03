import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import { providerFuture, routerFuture, routes } from "../routes";

/** Renders the real app (auth provider + route tree) at the given URL. */
export function renderRoute(path = "/", options: { inactivityLimitMs?: number } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path], future: routerFuture });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider inactivityLimitMs={options.inactivityLimitMs}>
        <RouterProvider router={router} future={providerFuture} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}
