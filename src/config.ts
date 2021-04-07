import * as yargs from "yargs";
import os from "os";
import { LogLevel } from "../util/logging";

// api key size
export const API_KEY_SIZE: number = 32;

// default values for NoOps
export const API: string = "https://api.github.com/repos";
export const MERGE_BODY: object = { commit_title: "merged by gitpayd" };

// interface for the config file
export interface ConfigFile {
  macaroonPath: string;
  lndHost: string;
  internalApiKey: string;
}

/**
 * Global settings for the server
 */
export enum GitpaydConfig {
  DEFAULT_PORT = 7777,
  DEFAULT_DEV_PORT = 7778,
  DEV = "DEV",
  DEFAULT_HOST = "127.0.0.1",
  DEFAULT_MAX_PAYMENT = 100000,
  DEFAULT_PAYMENT_THRESHOLD = 250000,
  HTTP_OK = 200,
  UNAUTHORIZED = 403,
  SERVER_FAILURE = 500
}

/**
 * Schema for SSL input
 */
export const SSL_SCHEMA: any = {
  properties: {
    sslpassphrase: {
      hidden: true,
    },
  },
};

/**
 * User input for the gitpayd-cli
 */
const ARGS = yargs
  .option("key-path", {
    string: true,
    alias: "kp",
    description: "Path to SSL private key",
    demand: true,
  })
  .option("cert-path", {
    string: true,
    alias: "cep",
    description: "Path to the server certification",
    demand: true,
  })
  .option("ca-path", {
    string: true,
    alias: "cap",
    description: "Path to the CA intermediate certification",
    demand: true,
  })
  .option("root-path", {
    string: true,
    alias: "rp",
    description: "Path to the root intermediate certification",
    demand: true,
  })
  .option("port", {
    number: true,
    alias: "p",
    description: "port to run the server",
    demand: false,
  })
  .option("dev-port", {
    number: true,
    alias: "dvp",
    description: "dev port to run the server",
    demand: false,
  })
  .option("host", {
    string: true,
    alias: "host",
    description: "ip to run the server",
    demand: false,
  })
  .option("owner", {
    string: true,
    alias: "o",
    description: "owner of the repo NoOps is running",
    demand: true,
  })
  .option("repo", {
    string: true,
    alias: "r",
    description: "name of the repo NoOps is running",
    demand: true,
  })
  .option("max-pay", {
    string: true,
    alias: "mp",
    description: "maximum allowable payment",
    demand: false,
  })
  .option("payment-threshold", {
    string: true,
    alias: "pt",
    description: "minimum channel balance to maintain",
    demand: false,
  })
  .option("log-level", {
    string: true,
    alias: "ll",
    description: "comma separated list of log levels to maintain",
    demand: false,
  }).argv;

// set https certs here
export const KEY_PATH: string = ARGS["key-path"];
export const CERT_PATH: string = ARGS["cert-path"];
export const CA_PATH: string = ARGS["ca-path"];
export const ROOT_PATH: string = ARGS["root-path"];
export const PORT: number =
  ARGS.port === undefined ? GitpaydConfig.DEFAULT_PORT : ARGS.port;
export const HOST: string =
  ARGS.host === undefined ? GitpaydConfig.DEFAULT_HOST : ARGS.host;
export const GITPAYD_ENV: string = process.env.GITPAYD_ENV;
export const DEV_PORT: number =
  ARGS["dev-port"] === undefined
    ? GitpaydConfig.DEFAULT_DEV_PORT
    : ARGS["dev-port"];
export const GITPAYD_OWNER: string = ARGS.owner;
export const GITPAYD_REPO: string = ARGS.repo;

// payment settings
const CUSTOM_MAX_PAYMENT: string = ARGS["max-pay"];
const CUSTOM_PAYMENT_THRESHOLD: string = ARGS["payment-threshold"];
const DEFAULT_MAX_PAYMENT: number = 100000;
const DEFAULT_PAYMENT_THRESHOLD: number = 250000;
export const MAX_PAYMENT: number | string =
  CUSTOM_MAX_PAYMENT === undefined
  ? DEFAULT_MAX_PAYMENT
  : parseInt(CUSTOM_MAX_PAYMENT, 10);
export const PAYMENT_THRESHOLD: number =
  CUSTOM_PAYMENT_THRESHOLD === undefined
    ? DEFAULT_PAYMENT_THRESHOLD
    : parseInt(CUSTOM_PAYMENT_THRESHOLD, 10);

// global log level
const LOG_LEVEL_ARG: string = ARGS["log-level"];
const IS_MULTI_LOG_LEVEL: boolean = LOG_LEVEL_ARG !== undefined
  && LOG_LEVEL_ARG.length > 0 && LOG_LEVEL_ARG.indexOf(",") > 0
const singleLogLevel: string[] = [];
if(!IS_MULTI_LOG_LEVEL && LOG_LEVEL_ARG !== undefined) {
  singleLogLevel.push(LOG_LEVEL_ARG);
} else {
  // default log level
  singleLogLevel.push("INFO");
  singleLogLevel.push("ERROR");
}
export const LOG_FILTERS: string[] | null = IS_MULTI_LOG_LEVEL
  ? LOG_LEVEL_ARG.split(",")
  : !IS_MULTI_LOG_LEVEL ? singleLogLevel
  : null;

// some defaults for linux
export const CONFIG_PATH: string = `${os.homedir()}/.gitpayd/config.json`;
export const DEFAULT_MACAROON: string = `${os.homedir()}/.lnd/data/chain/bitcoin/mainnet/admin.macaroon`;
export const DEFAULT_LND_HOST: string = "https://localhost:8080";
export const INDENT = 2;
export const DEFAULT_CONFIG: ConfigFile = {
  macaroonPath: DEFAULT_MACAROON,
  lndHost: DEFAULT_LND_HOST,
  internalApiKey: "",
};

/**
 * Used in conjunction with api requests in order to reduce
 * cognitive complexity
 */
export enum PaymentAction {
  DECODE = "DECODE",
  PAY = "PAY",
  RETURN_BALANCE = "RETURN_BALANCE",
}