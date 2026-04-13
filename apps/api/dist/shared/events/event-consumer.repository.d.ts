import { Event } from './types';
export { Event };
export declare function ensureProcessedEventsTable(): Promise<void>;
export declare function fetchUnprocessedEvents(limit?: number): Promise<Event[]>;
export declare function markEventProcessed(eventId: string): Promise<void>;
//# sourceMappingURL=event-consumer.repository.d.ts.map