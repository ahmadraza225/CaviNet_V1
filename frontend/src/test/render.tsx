import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { providerFuture, routerFuture, routes } from "../routes";

/** Renders the real route tree at the given URL with a fresh query client. */
export function renderRoute(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path], future: routerFuture });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={providerFuture} />
    </QueryClientProvider>,
  );
}

export function mockFetchJson(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
