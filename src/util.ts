import { GitpaydMode } from "./config";
import log, { LogLevel } from "./logging";
import os from "os";

/**
 * Authorized roles
 */
export enum AuthorizedRoles {
  COLLABORATOR = "COLLABORATOR",
  OWNER = "OWNER",
  MEMBER = "MEMBER",
}

/**
 * Delimiters for parsing data from Github
 */
export enum Delimiters {
  ISSUE = "Closes #",
  INVOICE = "LN:",
  BOUNTY = "Bounty: ",
}

/**
 * Helper function for parsing values from github metadata
 * @param {string} str - body from the api call
 * @param {string} delimiter - split on this
 * @returns String
 */
export const splitter = (body: string, delimiter: string): string | null => {
  const PRE_PARSE = body.split(delimiter);
  return PRE_PARSE[1] ? PRE_PARSE[1].split("\n")[0].trim() : null;
};

/**
 * Perform validation on collaborators
 * @param {string} role - role extracted from the pull request
 * @returns boolean
 */
export const validateCollaborators = (role: AuthorizedRoles): boolean => {
  return (
    role === AuthorizedRoles.COLLABORATOR ||
    role === AuthorizedRoles.OWNER ||
    role === AuthorizedRoles.MEMBER
  );
};

/**
 * Log the port of server mode
 * @param port - port server started on
 * @param mode - mode server started on
 * @param startTime - server start time
 */
export async function logStartup(
  port: number,
  mode: GitpaydMode,
  startTime: number
): Promise<void> {
  const END_TIME: number = new Date().getMilliseconds() - startTime;
  const REAL_TIME: number = END_TIME < 0 ? END_TIME * -1 : END_TIME;
  await log(
    `gitpayd ${mode} started in ${REAL_TIME}ms on ${os.hostname()}:${port}`,
    LogLevel.INFO,
    true
  );
}
