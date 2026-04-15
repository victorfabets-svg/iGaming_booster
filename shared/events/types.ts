export interface Event {
  id?: string;
  event_id?: string;
  event_type: string;
  event_version?: string;
  version?: string;
  timestamp?: string;
  producer: string;
  correlation_id?: string;
  payload: Record<string, any>;
}