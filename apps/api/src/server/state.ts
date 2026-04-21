// Global state for API runtime
// Used to track DB status without requiring DB connection

let dbHealthy = false;

export function setDbHealth(status: boolean): void {
  dbHealthy = status;
}

export function getDbHealth(): boolean {
  return dbHealthy;
}