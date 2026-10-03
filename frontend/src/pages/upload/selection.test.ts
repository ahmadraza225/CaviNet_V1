import { describe, expect, it } from "vitest";

import { fakeFile } from "../../test/xhr";
import { describeSelection, selectionProblem } from "./selection";

describe("upload selection checks (same as the server, FR-04.1)", () => {
  it("accepts one zip or any number of other files", () => {
    expect(selectionProblem([fakeFile("scan.ZIP")])).toBeNull();
    expect(selectionProblem([fakeFile("1.dcm"), fakeFile("IM0002")])).toBeNull();
  });

  it("needs at least one file", () => {
    expect(selectionProblem([])).toBe("Choose a .zip file or the scan's .dcm files to upload.");
  });

  it("allows exactly 1.5 GB and refuses one byte more", () => {
    expect(selectionProblem([fakeFile("a.zip", 1536 * 1024 ** 2)])).toBeNull();
    expect(selectionProblem([fakeFile("a.zip", 1536 * 1024 ** 2 + 1)])).toMatch(/1\.5 GB limit/);
  });

  it("describes the selection", () => {
    expect(describeSelection([fakeFile("a.dcm", 2 * 1024 ** 2)])).toBe("1 file (2.0 MB)");
  });
});
