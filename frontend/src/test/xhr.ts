import { vi } from "vitest";

/** A stand-in for XMLHttpRequest so tests can drive upload progress and responses. */
export class FakeXhr {
  static sent: FakeXhr[] = [];
  /** Called on send(); lets a test answer automatically. */
  static onSend: ((xhr: FakeXhr) => void) | null = null;

  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = "";
  aborted = false;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: FormData) {
    this.body = body;
    FakeXhr.sent.push(this);
    FakeXhr.onSend?.(this);
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  // --- test controls ---
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }

  failNetwork() {
    this.onerror?.();
  }

  files(): File[] {
    return (this.body?.getAll("files") ?? []) as File[];
  }
}

export function mockXhr(onSend: ((xhr: FakeXhr) => void) | null = null) {
  FakeXhr.sent = [];
  FakeXhr.onSend = onSend;
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  return FakeXhr;
}

/** A File of the given size without allocating it (size is what the checks look at). */
export function fakeFile(name: string, size = 1024): File {
  const file = new File(["x"], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}
