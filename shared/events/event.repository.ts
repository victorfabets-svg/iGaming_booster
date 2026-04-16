// =================================================================
// DEPRECATED - DO NOT USE
// All event creation should go through transactional outbox
// Use: import { withTransactionalOutbox, insertEventInTransaction } from './transactional-outbox'
// =================================================================
// This file re-exports legacy functions for backward compatibility ONLY
// DELETE THIS FILE AFTER ALL CONSUMERS ARE MIGRATED

// Migration guide:
// FROM: import { createEvent } from './event.repository'
// TO:   import { withTransactionalOutbox, insertEventInTransaction } from './transactional-outbox'
//
// OLD:
//   await createEvent({ event_type: '...', payload: {...}, producer: '...' })
//
// NEW:
//   await withTransactionalOutbox(async (client) => {
//     await insertEventInTransaction(client, '...', {...}, '...')
//   })

export { Event } from './types';

// DEPRECATED - throws error if called
export async function createEvent(...args: any[]) {
  throw new Error('DEPRECATED: Use transactional-outbox. Import from ./transactional-outbox instead');
}

export async function saveEvent(...args: any[]) {
  throw new Error('DEPRECATED: Use transactional-outbox. Import from ./transactional-outbox instead');
}
