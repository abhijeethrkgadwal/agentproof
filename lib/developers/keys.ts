import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { join } from "path";
import { readJsonFile, writeJsonFile } from "@/lib/storage/ephemeralFile";

export type ProjectEnvironment = "test" | "live";

export type DeveloperProject = {
  projectId: string;
  name: string;
  createdAt: string;
  environments: ProjectEnvironment[];
};

export type ApiKeyRecord = {
  keyId: string;
  projectId: string;
  environment: ProjectEnvironment;
  /** sha256 hex of secret */
  secretHash: string;
  prefix: string;
  createdAt: string;
  revoked: boolean;
};

const DATA_DIR = join(process.cwd(), "data", "developers");
const PROJECTS_FILE = join(DATA_DIR, "projects.json");
const KEYS_FILE = join(DATA_DIR, "api-keys.json");

declare global {
  var __agentproofProjects: DeveloperProject[] | undefined;
  var __agentproofApiKeys: ApiKeyRecord[] | undefined;
}

function loadJson<T>(file: string, fallback: T): T {
  const parsed = readJsonFile<T>(file);
  return parsed ?? fallback;
}

function saveJson(file: string, data: unknown): void {
  writeJsonFile(file, data);
}

function projects(): DeveloperProject[] {
  if (!globalThis.__agentproofProjects) {
    globalThis.__agentproofProjects = loadJson(PROJECTS_FILE, []);
  }
  return globalThis.__agentproofProjects;
}

function keys(): ApiKeyRecord[] {
  if (!globalThis.__agentproofApiKeys) {
    globalThis.__agentproofApiKeys = loadJson(KEYS_FILE, []);
  }
  return globalThis.__agentproofApiKeys;
}

function persist(): void {
  saveJson(PROJECTS_FILE, projects());
  saveJson(KEYS_FILE, keys());
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function createProject(name: string): DeveloperProject {
  const project: DeveloperProject = {
    projectId: `proj_${randomBytes(8).toString("hex")}`,
    name: name.trim().slice(0, 80) || "Untitled project",
    createdAt: new Date().toISOString(),
    environments: ["test", "live"],
  };
  projects().push(project);
  persist();
  return project;
}

export function listProjects(): DeveloperProject[] {
  return [...projects()];
}

export function createApiKey(input: {
  projectId: string;
  environment: ProjectEnvironment;
}): { record: ApiKeyRecord; secret: string } | { error: string } {
  const project = projects().find((p) => p.projectId === input.projectId);
  if (!project) return { error: "project_not_found" };
  if (!project.environments.includes(input.environment)) {
    return { error: "invalid_environment" };
  }
  const secret = `ap_${input.environment}_${randomBytes(24).toString("hex")}`;
  const record: ApiKeyRecord = {
    keyId: `key_${randomBytes(6).toString("hex")}`,
    projectId: input.projectId,
    environment: input.environment,
    secretHash: hashSecret(secret),
    prefix: secret.slice(0, 12),
    createdAt: new Date().toISOString(),
    revoked: false,
  };
  keys().push(record);
  persist();
  return { record, secret };
}

export function verifyApiKey(
  secret: string,
): { ok: true; projectId: string; environment: ProjectEnvironment } | { ok: false } {
  const hash = hashSecret(secret);
  const found = keys().find((k) => !k.revoked && k.secretHash === hash);
  if (!found) return { ok: false };
  // constant-time-ish compare already via hash equality length check
  const a = Buffer.from(found.secretHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  return {
    ok: true,
    projectId: found.projectId,
    environment: found.environment,
  };
}

export function revokeApiKey(keyId: string): boolean {
  const found = keys().find((k) => k.keyId === keyId);
  if (!found) return false;
  found.revoked = true;
  persist();
  return true;
}

export function listApiKeys(projectId: string): Omit<ApiKeyRecord, "secretHash">[] {
  return keys()
    .filter((k) => k.projectId === projectId)
    .map((k) => ({
      keyId: k.keyId,
      projectId: k.projectId,
      environment: k.environment,
      prefix: k.prefix,
      createdAt: k.createdAt,
      revoked: k.revoked,
    }));
}
