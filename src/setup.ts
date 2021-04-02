import axios, { AxiosResponse } from 'axios';
import https from 'https';
import {promises as fsp} from 'fs';
import log, { LogLevel } from './logging';
import os from 'os';
import { randomBytes } from 'crypto';
let globalLndHost: string;
let globalApiKey: string;

// set https certs here
export const KEY_PATH: string = process.env.KEY_PATH;
export const CERT_PATH: string = process.env.CERT_PATH;
export const CA_PATH: string = process.env.CA_PATH;
export const ROOT_PATH: string = process.env.ROOT_PATH;
export const PASSPHRASE: string = process.env.PASSPHRASE;

// api key size
const API_KEY_SIZE: number = 32;

// interface for the config file
interface ConfigFile {
    macaroonPath: string
    lndHost: string
    internalApiKey: string
}

/**
 * Global settings for the server
 */
export enum GitpaydConfig {
    SECURE_PORT = 443,
    MAX_PAYMENT = 100000,
    PAYMENT_THRESHOLD = 250000,
    HTTP_OK = 200,
    UNAUTHORIZED = 403,
    SERVER_FAILURE = 500,
}

/**
 * Authorized roles
 */
export enum AuthorizedRoles {
    COLLABORATOR = 'COLLABORATOR',
    OWNER = 'OWNER'
}

// some defaults for linux
export const CONFIG_PATH: string = `${os.homedir()}/.gitpayd/config.json`;
export const DEFAULT_MACAROON: string = `${os.homedir()}/.lnd/data/chain/bitcoin/mainnet/admin.macaroon`;
export const DEFAULT_LND_HOST: string = 'https://localhost:8080';
export const INDENT = 2;
const DEFAULT_CONFIG: ConfigFile = {
    macaroonPath: DEFAULT_MACAROON,
    lndHost: DEFAULT_LND_HOST,
    internalApiKey: ''
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
 * Generate the internal api key
 * It is validated against Github secrets.API_KEY
 */
 export async function generateInternalApkiKey():Promise<void> {
    const buf:Buffer = randomBytes(API_KEY_SIZE);
    log(`generated api key of length ${buf.length}`, LogLevel.INFO, true);
    DEFAULT_CONFIG.internalApiKey = buf.toString('hex');
}

// Handle LND TLS error at the request level
const agent = new https.Agent({ rejectUnauthorized: false });

// accessor for the api key
export const getInternalApiKey = (): string => { return globalApiKey; }

/**
 * Hit the LND Node and see if it returns data
 * @param {string} host
 * @param {number} startTime
 */
async function testLnd(host:string, startTime:number):Promise<void> {
    const INFO = await axios.get(`${host}/v1/getinfo`, { httpsAgent: agent })
    log(`found lnd version: ${INFO.data.version.split('commit=')[0]}`, LogLevel.INFO, true)
    const END_TIME:number = new Date().getMilliseconds() - startTime;
    const REAL_TIME:number = END_TIME < 0 ? END_TIME * -1 : END_TIME;
    log(`gitpayd started in ${REAL_TIME} ms on ${os.hostname()}`, LogLevel.INFO, true);
}

/**
 * Check for a config file. If no config file
 * exists create some default values so we can
 * check for the LND node existing
 */
export default async function setup():Promise<void> {
    const startTime: number = new Date().getMilliseconds();
    let config: ConfigFile | Buffer;
    try {
        config = await fsp.readFile(CONFIG_PATH);
    } catch {
        log('no config file found', LogLevel.ERROR, true);
        // none found, write it
        await generateInternalApkiKey()
            .catch(() => log(`failed to generate api key`, LogLevel.INFO, true));
        await fsp.mkdir(`${os.homedir()}/.gitpayd/`)
            .catch(() => log(`path for config already exists`, LogLevel.INFO, true));
        await fsp.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, INDENT))
            .catch(() => log('failed to write config file', LogLevel.INFO, true));
        config = await fsp.readFile(CONFIG_PATH);
    }
    // get macaroon from config file path
    const MACAROON: string =
        (await fsp.readFile(JSON.parse(config.toString()).macaroonPath)).toString('hex');
    const INTERNAL_API_KEY: string = JSON.parse(config.toString()).internalApiKey;
    // set macaroon in axios header
    axios.defaults.headers.get['Grpc-Metadata-macaroon'] = MACAROON;
    axios.defaults.headers.post['Grpc-Metadata-macaroon'] = MACAROON;
    // api call to lnd node
    const LND_HOST: string = JSON.parse(config.toString()).lndHost;
    globalLndHost = LND_HOST;
    globalApiKey = INTERNAL_API_KEY;
    testLnd(LND_HOST, startTime).catch(() => { throw new Error('LND is not online. Exiting...') });
}

/**
 * Re-usable function for doing LND Stuff
 * @param {string} paymentRequest - invoice sent to gitpayd
 * @param {PaymentAction} action - decode, get the channel balance, or process payments
 */
export function handlePaymentAction(paymentRequest: string | null, action: PaymentAction): Promise<AxiosResponse<any>> {
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
            { payment_request: paymentRequest },
            { httpsAgent: agent })
        default:
            return axios.get(`${globalLndHost}/v1/getinfo`, { httpsAgent: agent })
    }
}