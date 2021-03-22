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
    // issue: duplicate log on startup to stdout
    const date = new Date().toISOString();
    const readLog = fs.createReadStream(logFile);
    fs.appendFile(logFile,`[${level}] ${date} => ${message}\n`, () => {
        readLog.pipe(process.stdout);
    });
}