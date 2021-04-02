import {promises as fs} from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import { ChildProcessWithoutNullStreams } from 'node:child_process';
export const logFile: string = `${os.homedir}/.gitpayd/app.log`;
let isFirstLog: boolean = true;

/**
 * Enum for the log level
 */
export enum LogLevel {
    INFO = 'INFO',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

/**
 * In-house logger since Typescript
 * doesn't like console.log()
 * @param {string} message - message to write
 * @param {LogLevel} level - level types to filter by
 * @param {boolean} write - true is writing to app.log file
 */
export default async function log(message: string, level: LogLevel, write:boolean): Promise<void> {
    // existing logs are volatile
    if (isFirstLog && write) { await fs.writeFile(logFile, ''); }
    isFirstLog = false;
    const date: string = new Date().toISOString();
    const logString: string = `[${level}]\t${date} => ${message}`;
    if (write) { fs.appendFile(logFile, `${logString}\n`); }
    const childLog: ChildProcessWithoutNullStreams = spawn('echo' , [`${logString}`]);
    childLog.stdout.pipe(process.stdout);
}