import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RecordedCall } from "../../test/api";
import { admin, doctor, mockApi, signedInAs } from "../../test/api";
import { makePatient, patientPage } from "../../test/patients";
import { renderRoute } from "../../test/render";

const amina = makePatient();
const bilal = makePatient({
  id: "p-2",
  full_name: "Bilal Ahmed",
  mr_number: "MR-2002",
  date_of_birth: "1990-01-31",
  age: 36,
  sex: "male",
});

function setup(reply: (call: RecordedCall) => ReturnType<typeof patientPage>) {
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/patients": (call) => ({ body: reply(call) }),
  });
}

const lastQuery = (api: ReturnType<typeof setup>) => {
  const calls = api.callsTo("GET", "/api/patients");
  return Object.fromEntries(calls[calls.length - 1].query.entries());
};

describe("Patient list (FR-03.3)", () => {
  it("lists patients with links, MR number, date of birth and sex", async () => {
    setup(() => patientPage([amina, bilal]));
    renderRoute("/patients");

    const link = await screen.findByRole("link", { name: "Amina Bibi" });
    expect(link).toHaveAttribute("href", "/patients/p-1");
    const row = link.closest("tr")!;
    expect(within(row).getByText("MR-1001")).toBeInTheDocument();
    expect(within(row).getByText(/12 Apr 1975/)).toBeInTheDocument();
    expect(within(row).getByText("(51 y)")).toBeInTheDocument();
    expect(within(row).getByText("Female")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1 · 2 patients")).toBeInTheDocument();
  });

  it("asks for newest first, 20 per page, by default", async () => {
    const api = setup(() => patientPage([amina]));
    renderRoute("/patients");
    await screen.findByRole("link", { name: "Amina Bibi" });

    expect(lastQuery(api)).toEqual({ sort: "created_at", order: "desc", page: "1" });
    expect(screen.getByRole("columnheader", { name: /Added/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("pages through results", async () => {
    const api = setup((call) =>
      patientPage(
        [call.query.get("page") === "2" ? bilal : amina],
        45,
        Number(call.query.get("page")),
      ),
    );
    renderRoute("/patients");
    await screen.findByText("Page 1 of 3 · 45 patients");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3 · 45 patients")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Bilal Ahmed" })).toBeInTheDocument();
    expect(lastQuery(api).page).toBe("2");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("disables Next on the last page", async () => {
    setup(() => patientPage([amina], 41, 3));
    renderRoute("/patients?page=3");

    await screen.findByText("Page 3 of 3 · 41 patients");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("searches by name or MR number and starts again at page 1", async () => {
    const api = setup((call) => patientPage(call.query.get("q") ? [bilal] : [amina, bilal], 45));
    const { router } = renderRoute("/patients?page=2");
    await screen.findByRole("link", { name: "Amina Bibi" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), {
      target: { value: " mr-2002 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(lastQuery(api)).toEqual({
        q: "mr-2002",
        sort: "created_at",
        order: "desc",
        page: "1",
      }),
    );
    expect(router.state.location.search).toBe("?q=mr-2002");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Amina Bibi" })).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => expect(lastQuery(api).q).toBeUndefined());
    expect(screen.getByRole("searchbox", { name: "Search patients" })).toHaveValue("");
  });

  it("restores the search, sort and page from the address", async () => {
    const api = setup(() => patientPage([amina], 30, 2));
    renderRoute("/patients?q=amina&sort=full_name&order=asc&page=2");
    await screen.findByRole("link", { name: "Amina Bibi" });

    expect(lastQuery(api)).toEqual({ q: "amina", sort: "full_name", order: "asc", page: "2" });
    expect(screen.getByRole("searchbox", { name: "Search patients" })).toHaveValue("amina");
  });

  it("sorts by a column and flips the order on a second click", async () => {
    const api = setup(() => patientPage([amina, bilal]));
    renderRoute("/patients");
    await screen.findByRole("link", { name: "Amina Bibi" });

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    await waitFor(() =>
      expect(lastQuery(api)).toEqual({ sort: "full_name", order: "asc", page: "1" }),
    );
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    await waitFor(() =>
      expect(lastQuery(api)).toEqual({ sort: "full_name", order: "desc", page: "1" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Date of birth/ }));
    await waitFor(() =>
      expect(lastQuery(api)).toEqual({ sort: "date_of_birth", order: "asc", page: "1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /MR number/ }));
    await waitFor(() => expect(lastQuery(api).sort).toBe("mr_number"));
    fireEvent.click(screen.getByRole("button", { name: /Last updated/ }));
    await waitFor(() =>
      expect(lastQuery(api)).toEqual({ sort: "updated_at", order: "desc", page: "1" }),
    );
  });

  it("explains an empty list", async () => {
    setup(() => patientPage([]));
    renderRoute("/patients");

    expect(
      await screen.findByText("No patients yet. Use Add patient to create the first record."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add patient" })).toHaveAttribute(
      "href",
      "/patients/new",
    );
  });

  it("explains a search with no matches", async () => {
    setup(() => patientPage([]));
    renderRoute("/patients?q=nobody");

    expect(await screen.findByText("No patients match “nobody”.")).toBeInTheDocument();
  });

  it("shows a notice passed by the previous page (e.g. after a delete)", async () => {
    setup(() => patientPage([]));
    const { router } = renderRoute("/patients");
    await screen.findByText(/No patients yet/);

    await act(() => router.navigate("/patients", { state: { notice: "Amina Bibi was deleted." } }));
    expect(await screen.findByText("Amina Bibi was deleted.")).toBeInTheDocument();
  });

  it("is reachable from the Patients menu item", async () => {
    setup(() => patientPage([amina]));
    renderRoute("/");
    await screen.findByRole("heading", { name: "Dashboard" });

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    fireEvent.click(within(nav).getByRole("link", { name: "Patients" }));
    expect(await screen.findByRole("heading", { name: "Patients" })).toBeInTheDocument();
  });

  it("is not available to administrators (section 9.3)", async () => {
    const api = mockApi(signedInAs(admin));
    renderRoute("/patients");

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(api.calls.some((call) => call.path.startsWith("/api/patients"))).toBe(false);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).queryByRole("link", { name: "Patients" })).not.toBeInTheDocument();
  });
});
