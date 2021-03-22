import axios from 'axios';
import https from 'https';
import fs from 'fs/promises';
import os from 'os';
import log from './logging';
import { LogLevel } from './logging';

// interface for the config file
interface ConfigFile {
    macaroonPath: string
    lndHost: string
}

// global settings for the daemon
export enum GitpaydConfig {
    PORT = 7777
}

// some defaults for linux
const CONFIG_PATH = `${os.homedir()}/.gitpayd/config.json`;
const DEFAULT_MACAROON = `${os.homedir()}/.lnd/data/chain/bitcoin/mainnet/admin.macaroon`;
const DEFAULT_LND_HOST = 'https://localhost:8080';
const INDENT = 2;
const DEFAULT_CONFIG: ConfigFile = {
    macaroonPath: DEFAULT_MACAROON,
    lndHost: DEFAULT_LND_HOST,
}
const logFile = 'app.log';

/**
 * Hit the LND Node and see if it returns data
 * @param host
 */
async function testLnd(host:string):Promise<void> {
    // Handle LND TLS error at the request level
    const agent = new https.Agent({
      rejectUnauthorized: false
    });
    const data = await axios.get(`${host}/v1/getinfo`, { httpsAgent: agent })
      .then(res => {
        return res.data;
    })
    .catch(() => {
        log('lnd failed to connect', LogLevel.ERROR);
        // something bad happened and we can't proceed without LND connectivity
        process.exit(1);
    })
    log(`gipayd started at http://localhost:${ GitpaydConfig.PORT }`, LogLevel.INFO);
    log(`found lnd version: ${data.version}`, LogLevel.INFO)
  }

/**
 * Check for a config file. If no config file
 * exists create some default values so we can
 * check for the LND node existing
 */
export default async function setup():Promise<void> {
    // setup new empty log file
    await fs.writeFile(logFile, '');
    let config:ConfigFile | Buffer;
    try {
        config = await fs.readFile(CONFIG_PATH);
    } catch {
        log('no config file found', LogLevel.ERROR);
        // none found, write it
        fs.mkdir(`${os.homedir()}/.gitpayd/`);
        fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, INDENT));
        config = await fs.readFile(CONFIG_PATH);
    }
    // get macaroon from config file path
    const macaroon:string = (await fs.readFile(JSON.parse(config.toString()).macaroonPath))
    .toString('hex');
    // set macaroon in axios header
    axios.defaults.headers.get['Grpc-Metadata-macaroon'] = macaroon;
    // api call to lnd node
    const host:string = JSON.parse(config.toString()).lndHost;
    testLnd(host);
}