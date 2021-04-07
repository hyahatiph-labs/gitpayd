import { promises as fs } from "fs";
import { spawn } from "child_process";
import os from "os";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { LOG_FILTERS } from "../src/config";
export const LOG_FILE: string = `${os.homedir}/.gitpayd/app.log`;
let isFirstLog: boolean = true;

/**
 * Enum for the log level
 */
export enum LogLevel {
  INFO = "INFO",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

/**
 * In-house logger since Typescript
 * doesn't like console.log()
 * @param {string} message - message to write
 * @param {LogLevel} level - level types to filter by
 * @param {boolean} write - true is writing to app.log file
 */
export default async function log(
  message: string,
  level: LogLevel,
  write: boolean
): Promise<void> {
  // existing logs are volatile
  if (isFirstLog && write) {
    await fs.writeFile(LOG_FILE, "");
  }
  isFirstLog = false;
  LOG_FILTERS.forEach((filter: LogLevel) => {
    if (filter === level) {
      const DATE: string = new Date().toISOString();
      const LOG_STRING: string = `[${level}]\t${DATE} => ${message}`;
      if (write) {
        fs.appendFile(LOG_FILE, `${LOG_STRING}\n`);
      }
      const CHILD_LOG: ChildProcessWithoutNullStreams = spawn("echo", [
        `${LOG_STRING}`,
      ]);
      CHILD_LOG.stdout.pipe(process.stdout);
    }
  });
}
