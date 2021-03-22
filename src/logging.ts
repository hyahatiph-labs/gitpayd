import fs from 'fs';
const logFile = 'app.log';

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
export default async function log(message:string, level:string):Promise<void> {
    const date = new Date().toISOString();
    const writeLog = await fs.writeFile(logFile,
        `[${level}] ${date} => ${message}\n`,
        err => {/* do nothing */});
    const readLog = fs.createReadStream(logFile);
    readLog.pipe(process.stdout);
}