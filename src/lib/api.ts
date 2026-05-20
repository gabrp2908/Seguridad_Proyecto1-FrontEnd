/**
 * Central API client — talks to the NestJS backend at localhost:3000.
 * All requests include credentials (session cookie).
 */

export const API_BASE = "http://localhost:3000";

const BASE = API_BASE;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const err = await res.json();
      msg = err.message ?? msg;
    } catch (_) {}
    throw new ApiError(msg, res.status);
  }

  // For blob responses (file download) return the raw Response
  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/octet-stream")) return res as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserDto {
  user_id: string;
  user_na: string;
  user_mail: string;
  public_key?: string;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<UserDto>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<UserDto>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forget-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};

// ─── Directory ────────────────────────────────────────────────────────────────

export interface DirectoryDto {
  directory_id: string;
  directory_name: string;
  user_id: string;
  parent?: DirectoryDto | null;
}

export const dirApi = {
  listRoot: () => request<DirectoryDto[]>("/directory"),

  listChildren: (parentId: string) =>
    request<DirectoryDto[]>(`/directory/${parentId}`),

  create: (name: string, parentId?: string | null) =>
    request<DirectoryDto>("/directory", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    }),

  rename: (id: string, name: string) =>
    request<DirectoryDto>(`/directory/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/directory/${id}`, { method: "DELETE" }),
};

// ─── Files ────────────────────────────────────────────────────────────────────

export interface ArchiveDto {
  archive_id: string;
  archive_na: string;
  hash: string;
  is_public: boolean;
  user_id: string;
  directory_id: string | null;
  share_token?: string | null;
}

export const fileApi = {
  /** Files in current directory (null = root) */
  list: (directoryId?: string | null) => {
    const q = directoryId ? `?directoryId=${directoryId}` : "?directoryId=root";
    return request<ArchiveDto[]>(`/file${q}`);
  },

  listPublic: () => request<ArchiveDto[]>("/file/public"),

  downloadShared: (token: string) =>
    request<Response>(`/file/download/shared/${token}`),

  upload: (file: File, directoryId?: string | null) => {
    const form = new FormData();
    form.append("file", file);
    if (directoryId) form.append("directoryId", directoryId);
    return request<ArchiveDto>("/file/upload", { method: "POST", body: form });
  },

  download: (id: string) =>
    request<Response>(`/file/download/${id}`),

  rename: (id: string, name: string) =>
    request<ArchiveDto>(`/file/${id}/rename`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  move: (id: string, directoryId: string | null) =>
    request<ArchiveDto>(`/file/${id}/move`, {
      method: "PUT",
      body: JSON.stringify({ directoryId }),
    }),

  setVisibility: (id: string, is_public: boolean) =>
    request<ArchiveDto>(`/file/${id}/visibility`, {
      method: "PUT",
      body: JSON.stringify({ is_public }),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/file/${id}`, { method: "DELETE" }),
};

// ─── Download helper ──────────────────────────────────────────────────────────

export async function downloadBlob(id: string) {
  const res = await fetch(`${BASE}/file/download/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new ApiError("Download failed", res.status);

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") ?? "";
  let filename = "download";
  const utf8Match = disp.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = disp.match(/filename="?([^";\n]+)"?/i);
  if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
  else if (asciiMatch) filename = asciiMatch[1];

  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
    style: "display:none",
  });
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}
