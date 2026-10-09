export const JIRA_TICKET_ROWS_PER_STATEMENT = 6;
export const JIRA_PARTICIPANT_ROWS_PER_STATEMENT = 16;
export const JIRA_DELETE_KEYS_PER_STATEMENT = 80;
export const JIRA_STATEMENTS_PER_BATCH = 50;

export function jiraImportChunks<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}
