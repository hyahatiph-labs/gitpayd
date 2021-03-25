import axios, { AxiosResponse } from 'axios';
import https from 'https';
import fsp from 'fs/promises';
import os from 'os';
import log, { LogLevel } from './logging';
let globalLndHost:string;
// Handle LND TLS error at the request level
const agent = new https.Agent({ rejectUnauthorized: false });

// interface for the config file
interface ConfigFile {
    macaroonPath: string
    lndHost: string
}

/**
 * Global settings for the server
 */
export enum GitpaydConfig {
    HOST = '0.0.0.0',
    PORT = 7777,
    MAX_PAYMENT = 100000,
    HTTP_OK = 200,
    SERVER_FAILURE = 500
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

/**
 * Hit the LND Node and see if it returns data
 * @param host
 * @param startTime
 */
async function testLnd(host:string, startTime:number):Promise<void> {
    const info = await axios.get(`${host}/v1/getinfo`, { httpsAgent: agent })
    log(`found lnd version: ${info.data.version}`, LogLevel.INFO, true)
    const endTime:number = new Date().getMilliseconds() - startTime;
    log(`gitpayd started in ${endTime} ms on ${os.hostname()}:${GitpaydConfig.PORT}`, LogLevel.INFO, true);
}

/**
 * Check for a config file. If no config file
 * exists create some default values so we can
 * check for the LND node existing
 */
export default async function setup():Promise<void> {
    const startTime:number = new Date().getMilliseconds();
    let config:ConfigFile | Buffer;
    try {
        config = await fsp.readFile(CONFIG_PATH);
    } catch {
        log('no config file found', LogLevel.ERROR, true);
        // none found, write it
        fsp.mkdir(`${os.homedir()}/.gitpayd/`);
        fsp.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, INDENT));
        config = await fsp.readFile(CONFIG_PATH);
    }
    // get macaroon from config file path
    const MACAROON:string =
        (await fsp.readFile(JSON.parse(config.toString()).macaroonPath)).toString('hex');
    // set macaroon in axios header
    axios.defaults.headers.get['Grpc-Metadata-macaroon'] = MACAROON;
    axios.defaults.headers.post['Grpc-Metadata-macaroon'] = MACAROON;
    // api call to lnd node
    const LND_HOST:string = JSON.parse(config.toString()).lndHost;
    globalLndHost = LND_HOST;
    testLnd(LND_HOST, startTime).catch(() => { throw new Error('LND is not online. Exiting...') });
}

/**
 * Used in conjunction with api requests in order to reduce
 * cognitive complexity
 */
export enum PaymentAction {
    DECODE = 'DECODE',
    PAY = 'PAY',
    BALANCE = 'BALANCE'
}

/**
 * Re-usable function for doing LND Stuff
 * @param paymentRequest
 * @param action
 * @param res
 */
export function handlePaymentAction(paymentRequest:string | null,
    action:PaymentAction, res:any):Promise<AxiosResponse<any>>{
    let handle;
    switch (action) {
        // case for decoding payment
        case PaymentAction.DECODE:
            return axios.get(`${globalLndHost}/v1/payreq/${paymentRequest}`, { httpsAgent: agent });
        // case for returning channel balance
        case PaymentAction.BALANCE:
            return axios.get(`${globalLndHost}/v1/balance/channels`, { httpsAgent: agent });
        // case for sending payment
        case PaymentAction.PAY:
            return axios.post(`${globalLndHost}/v1/channels/transactions`,
            {
                httpsAgent: agent,
                payment_request: paymentRequest
            })
        default:
            handle = null;
    }
}