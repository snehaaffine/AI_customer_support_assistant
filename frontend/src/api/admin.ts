import { ApiError, apiFetch } from "./client.js";

const TOKEN_KEY = "csa_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new ApiError("Not authenticated", 401);

  return apiFetch<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

export interface SystemConfig {
  systemPrompt: string;
  promptVersion: number;
  updatedAt: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  updatedAt: string;
}

export interface EscalationRecord {
  id: string;
  sessionId: string;
  customerEmail: string;
  message: string;
  createdAt: string;
}

export function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  return apiFetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function fetchAdminConfig(): Promise<SystemConfig> {
  return adminFetch("/api/admin/config");
}

export function updateAdminConfig(
  systemPrompt: string
): Promise<SystemConfig> {
  return adminFetch("/api/admin/config", {
    method: "PUT",
    body: JSON.stringify({ systemPrompt }),
  });
}

export function fetchEscalationRules(): Promise<{ rules: EscalationRule[] }> {
  return adminFetch("/api/admin/escalation-rules");
}

export function updateEscalationRule(
  id: string,
  data: { enabled?: boolean; priority?: number }
): Promise<{ rule: EscalationRule }> {
  return adminFetch(`/api/admin/escalation-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchRecentEscalations(): Promise<{
  escalations: EscalationRecord[];
}> {
  return adminFetch("/api/admin/escalations?limit=20");
}
