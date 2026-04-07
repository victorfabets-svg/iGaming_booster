export interface Event {
  event_id?: string;
  event_type: string;
  version: string;
  timestamp?: string;
  producer: string;
  correlation_id?: string;
  payload: Record<string, any>;
}