export interface EventInput {
    event_type: string;
    version: string;
    payload: Record<string, unknown>;
    producer: string;
    correlation_id?: string;
}
export interface StoredEvent {
    id: string;
    event_type: string;
    version: string;
    timestamp: Date;
    producer: string;
    correlation_id: string;
    payload: Record<string, unknown>;
}
export declare function createEvent(input: EventInput): Promise<StoredEvent>;
export declare function findEventsByType(eventType: string): Promise<StoredEvent[]>;
export declare function findAllEvents(limit?: number): Promise<StoredEvent[]>;
//# sourceMappingURL=event.repository.d.ts.map