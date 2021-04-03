import * as yargs from 'yargs';
import os from 'os';

// api key size
export const API_KEY_SIZE: number = 32;

// TODO: get passphrase as input
export const PASSPHRASE = process.env.GITPAYD_SSL_PASSPHRASE;

// interface for the config file
export interface ConfigFile {
    macaroonPath: string
    lndHost: string
    internalApiKey: string
}

/**
 * Global settings for the server
 */
export enum GitpaydConfig {
    DEFAULT_PORT = 7777,
    DEFAULT_IP = '127.0.0.1',
    DEFAULT_MAX_PAYMENT = 100000,
    DEFAULT_PAYMENT_THRESHOLD = 250000,
    HTTP_OK = 200,
    UNAUTHORIZED = 403,
    SERVER_FAILURE = 500
}

/**
 * Schema for SSL input
 */
export const SCHEMA: any = {
    properties: {
      sslpassphrase: {
        hidden: true
      }
    }
  };

/**
 * User input for the gitpayd-cli
 */
const ARGS = yargs
        .option('key-path', {
            string: true,
            alias: 'kp',
            description: 'Path to SSL private key',
            demand: true
        })
        .option('cert-path', {
            string: true,
            alias: 'cep',
            description: "Path to the server certification",
            demand: true
        })
        .option('ca-path', {
            string: true,
            alias: 'cap',
            description: "Path to the CA intermediate certification",
            demand: true
        })
        .option('root-path', {
            string: true,
            alias: 'rp',
            description: "Path to the root intermediate certification",
            demand: true
        })
        .option('port', {
            number: true,
            alias: 'p',
            description: "port to run the server",
            demand: false
        })
        .option('ip', {
            string: true,
            alias: 'ip',
            description: "ip to run the server",
            demand: false
        }).argv;

// set https certs here
export const KEY_PATH: string = ARGS['key-path'];
export const CERT_PATH: string = ARGS['cert-path'];
export const CA_PATH: string = ARGS['ca-path'];
export const ROOT_PATH: string = ARGS['root-path'];
export const PORT: number = ARGS.port === undefined ? GitpaydConfig.DEFAULT_PORT : ARGS.port;
export const IP: string = ARGS.ip === undefined ? GitpaydConfig.DEFAULT_IP : ARGS.ip;

// some defaults for linux
export const CONFIG_PATH: string = `${os.homedir()}/.gitpayd/config.json`;
export const DEFAULT_MACAROON: string = `${os.homedir()}/.lnd/data/chain/bitcoin/mainnet/admin.macaroon`;
export const DEFAULT_LND_HOST: string = 'https://localhost:8080';
export const INDENT = 2;
export const DEFAULT_CONFIG: ConfigFile = {
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