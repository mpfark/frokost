/** Shared pacing helper for transactional email batches. */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
