export interface Event {
    id: string;
    event_type: string;
    version: string;
    timestamp: Date;
    producer: string;
    correlation_id: string;
    payload: Record<string, unknown>;
}
export interface ProcessedEvent {
    event_id: string;
    consumer_name: string;
    processed_at: Date;
}
export declare function ensureProcessedEventsTable(): Promise<void>;
export declare function isEventProcessed(eventId: string): Promise<boolean>;
export declare function markEventProcessed(eventId: string): Promise<void>;
export declare function fetchUnprocessedEvents(eventType: string, limit?: number): Promise<Event[]>;
//# sourceMappingURL=event-consumer.repository.d.ts.map