import axios, { isAxiosError } from "axios";

export const API_KEY_STORAGE = "aaas_api_key";

/** The FastAPI service. Dev requests use `/api/v1` and Vite forwards them here. */
export const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: "/api/v1",
});

api.interceptors.request.use((config) => {
  const key = localStorage.getItem(API_KEY_STORAGE);
  if (key) {
    config.headers.set("X-API-Key", key);
  }
  return config;
});

export type Agent = {
  id: string;
  slug: string;
  name: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  created_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  agent_id: string;
  context_data: Record<string, unknown>;
  created_at: string;
};

export type ChatReply = {
  session_id: string;
  agent_id: string;
  message: string;
};

export type UploadedDocument = {
  id: string;
  title: string;
  agent_id: string;
};

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? "";
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;
    if (typeof detail === "string" && detail) {
      return detail;
    }
    if (error.response?.status === 401) {
      return "That API key was rejected.";
    }
    if (error.code === "ERR_NETWORK") {
      return "The API at http://127.0.0.1:8000 is not reachable.";
    }
  }
  return "The request failed.";
}

export async function getAgents(): Promise<Agent[]> {
  const { data } = await api.get<Agent[]>("/agents");
  return data;
}

export async function createAgent(input: {
  name: string;
  system_prompt: string;
}): Promise<Agent> {
  const { data } = await api.post<Agent>("/agents", input);
  return data;
}

export async function getSessions(agentId: string): Promise<Session[]> {
  const { data } = await api.get<Session>("/sessions/resolve", {
    params: { agent_id: agentId },
  });
  return [data];
}

export async function createSession(agentId: string): Promise<Session> {
  const { data } = await api.post<Session>("/sessions", {
    agent_id: agentId,
    context_data: {},
  });
  return data;
}

export async function sendMessage(input: {
  agentId: string;
  sessionId: string;
  message: string;
}): Promise<ChatReply> {
  const { data } = await api.post<ChatReply>("/chat", {
    agent_id: input.agentId,
    session_id: input.sessionId,
    message: input.message,
  });
  return data;
}

export async function uploadDocument(agentId: string, file: File): Promise<UploadedDocument> {
  const body = new FormData();
  body.append("agent_id", agentId);
  body.append("file", file);
  const { data } = await api.post<UploadedDocument>("/ingest/upload", body);
  return data;
}
