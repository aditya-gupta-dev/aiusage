export type AgentId = string;
export interface UsageEvent {
  id: string;
  agent: AgentId;
  model: string;
  session: string;
  project: string;
  timestamp: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  total: number;
  cost: number | null;
  costSource: "recorded" | "estimated" | "unknown";
  unpricedReason?: string;
}
export interface Source {
  id: string;
  name: string;
  installed: boolean;
  status: "connected" | "empty" | "missing" | "unsupported" | "error";
  paths: string[];
  files: number;
  events: number;
  errors: number;
  note: string;
}
export interface UsageResponse {
  events: UsageEvent[];
  rawEvents: UsageEvent[];
  engine: string;
  sources: Source[];
  scannedAt: string;
  duration: number;
  pricingUpdated: string;
}
