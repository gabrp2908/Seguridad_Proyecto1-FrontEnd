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

  downloadShared: (token: string, clientPublicKey?: string) =>
    request<Response>(`/file/download/shared/${token}`, {
      headers: clientPublicKey ? { 'x-client-public-key': clientPublicKey } : undefined,
    }),

  upload: async (file: File, directoryId?: string | null) => {
    // Pasos 1 y 2: Solicitud de llave pública (El servidor genera un par nuevo)
    const initRes = await request<{ uploadToken: string; publicKey: string }>("/file/upload/init", { 
      method: "POST" 
    });

    // Paso 5: Hashear archivo en texto plano y encriptar con llave simétrica
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const plainHash = await sha256Hex(fileBytes); // Reutilizamos tu helper sha256Hex

    // Generar llave AES-GCM 256
    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"]
    );
    const exportedAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const iv = crypto.getRandomValues(new Uint8Array(16));

    const cipherTextWithTagBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      fileBytes
    );

    // Separamos el CipherText del AuthTag (WebCrypto concatena el AuthTag al final)
    const cipherTextWithTag = new Uint8Array(cipherTextWithTagBuffer);
    const cipherText = cipherTextWithTag.slice(0, -16);
    const authTag = cipherTextWithTag.slice(-16);

    const symmetricPayload = {
      key: Array.from(new Uint8Array(exportedAesKey)).map((b) => b.toString(16).padStart(2, "0")).join(""),
      iv: Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join(""),
      authTag: Array.from(authTag).map((b) => b.toString(16).padStart(2, "0")).join(""),
    };

    // Paso 6: Encriptar llave simétrica y hash con la llave pública del servidor
    const serverPublicKey = await importServerPublicKey(initRes.publicKey);
    const encryptedSymmetricKey = await encryptHeaderPayload(serverPublicKey, JSON.stringify(symmetricPayload));
    const encryptedHash = await encryptHeaderPayload(serverPublicKey, plainHash);

    // Paso 7: Enviar todo encriptado
    const form = new FormData();
    // Enviamos SOLO el ciphertext. El AuthTag va seguro dentro del symmetricPayload.
    const encryptedBlob = new Blob([cipherText], { type: "application/octet-stream" });
    form.append("file", encryptedBlob, file.name); 
    
    if (directoryId) form.append("directoryId", directoryId);
    form.append("uploadToken", initRes.uploadToken);
    form.append("encryptedSymmetricKey", encryptedSymmetricKey);
    form.append("encryptedHash", encryptedHash);

    return request<ArchiveDto>("/file/upload", { method: "POST", body: form });
  },

  download: (id: string, clientPublicKey?: string) =>
    request<Response>(`/file/download/${id}`, {
      headers: clientPublicKey ? { 'x-client-public-key': clientPublicKey } : undefined,
    }),

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

// ─── Upload helpers ──────────────────────────────────────────────────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64Lines = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
  return base64ToArrayBuffer(b64Lines);
}

async function importServerPublicKey(pem: string): Promise<CryptoKey> {
  const binaryDer = pemToArrayBuffer(pem);
  return await crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

async function encryptHeaderPayload(publicKey: CryptoKey, payload: string): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
  return arrayBufferToBase64(encrypted);
}


// ─── Download helper ──────────────────────────────────────────────────────────
type SymmetricPayload = {
  key: string;
  iv: string;
  authTag: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex payload inválido");
  }

  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateClientKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return {
    privateKey: keyPair.privateKey,
    publicKeyBase64: arrayBufferToBase64(publicKeyBuffer),
  };
}

async function decryptHeaderPayload(privateKey: CryptoKey, encryptedBase64: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(encryptedBase64),
  );
  return new TextDecoder().decode(decrypted);
}

function getFilenameFromHeader(disposition: string | null): string {
  const disp = disposition ?? "";
  const utf8Match = disp.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = disp.match(/filename="?([^";\n]+)"?/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  if (asciiMatch) return asciiMatch[1];
  return "download";
}

function saveBlob(blob: Blob, filename: string) {
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

async function decryptAndVerifyBlob(
  encryptedBlob: Blob,
  decryptedSymmetricPayload: string,
  decryptedHash: string,
): Promise<Blob> {
  let symmetricPayload: SymmetricPayload;
  try {
    symmetricPayload = JSON.parse(decryptedSymmetricPayload) as SymmetricPayload;
  } catch {
    throw new Error("No se pudo parsear la llave simétrica");
  }

  if (!symmetricPayload.key || !symmetricPayload.iv || !symmetricPayload.authTag) {
    throw new Error("Payload simétrico incompleto");
  }

  const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
  const authTagBytes = hexToBytes(symmetricPayload.authTag);
  const cipherTextWithTag = concatBytes(encryptedBytes, authTagBytes);

  const aesKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(symmetricPayload.key),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: hexToBytes(symmetricPayload.iv),
      tagLength: 128,
    },
    aesKey,
    cipherTextWithTag,
  );

  const decryptedBytes = new Uint8Array(decryptedBuffer);
  const calculatedHash = await sha256Hex(decryptedBytes);
  if (calculatedHash !== decryptedHash.toLowerCase()) {
    throw new Error("Integridad comprometida: hash no coincide");
  }

  return new Blob([decryptedBytes], { type: "application/octet-stream" });
}

async function secureDownload(
  requester: (clientPublicKey: string) => Promise<Response>,
): Promise<void> {
  try {
    const { privateKey, publicKeyBase64 } = await generateClientKeyPair();
    const res = await requester(publicKeyBase64);

    const encryptedSymmetricKey = res.headers.get("x-crypto-symmetric-key");
    const encryptedHash = res.headers.get("x-file-hash");
    if (!encryptedSymmetricKey || !encryptedHash) {
      throw new Error("Faltan headers criptográficos de descarga");
    }

    const [encryptedBlob, decryptedSymmetricPayload, decryptedHash] = await Promise.all([
      res.blob(),
      decryptHeaderPayload(privateKey, encryptedSymmetricKey),
      decryptHeaderPayload(privateKey, encryptedHash),
    ]);

    const decryptedBlob = await decryptAndVerifyBlob(
      encryptedBlob,
      decryptedSymmetricPayload,
      decryptedHash,
    );

    const filename = getFilenameFromHeader(res.headers.get("Content-Disposition"));
    saveBlob(decryptedBlob, filename);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Secure download failed",
      500,
    );
  }
}

export async function downloadBlob(id: string) {
  await secureDownload((clientPublicKey) => fileApi.download(id, clientPublicKey));
}

export async function downloadBlobShared(token: string) {
  await secureDownload((clientPublicKey) =>
    fileApi.downloadShared(token, clientPublicKey),
  );
}