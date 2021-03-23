import fs from 'fs/promises';
import { spawn } from 'child_process';
const logFile = 'app.log';
let isFirstLog = true;

/**
 * Enum for the log level
 */
export enum LogLevel {
    INFO = 'INFO',
    ERROR = 'ERROR'
}

/**
 * In-house logger since Typescript
 * doesn't like console.log()
 * @param message - message to write
 * @param level - level types to filter by
 */
export default async function log(message:string, level:LogLevel):Promise<void> {
    // existing logs are volatile
    if(isFirstLog) { await fs.writeFile(logFile, ''); }
    isFirstLog = false;
    const date:string = new Date().toISOString();
    const logString:string = `[${level}] ${date} => ${message}`
    fs.appendFile(logFile, `${logString}\n`);
    const childLog = spawn('echo' , [`${logString}`])
    childLog.stdout.pipe(process.stdout)
}