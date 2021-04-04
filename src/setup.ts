import axios, { AxiosResponse } from "axios";
import https from "https";
import { promises as fsp } from "fs";
import log, { LogLevel } from "./logging";
import os from "os";
import { randomBytes } from "crypto";
import {
  API_KEY_SIZE,
  ConfigFile,
  CONFIG_PATH,
  DEFAULT_CONFIG,
  INDENT,
  PaymentAction,
  PORT,
} from "./config";
import prompt from "prompt";

let globalLndHost: string;
let globalApiKey: string;

// set github token on setup
let internalGithubToken: string;

/**
 * Accessor for the github token
 * @returns - api key
 */
 export const getGithubToken = (): object => {
  return { authorization: `token ${internalGithubToken}` };
};

/**
 * Mutator for the github token
 * @returns - api key
 */
 export const setGithubToken = (tokenInput: string): void => {
  internalGithubToken = tokenInput;
};

/**
 * Generate the internal api key
 * It is validated against Github secrets.API_KEY
 */
export async function generateInternalApkiKey(): Promise<void> {
  const buf: Buffer = randomBytes(API_KEY_SIZE);
  log(`generated api key of length ${buf.length}`, LogLevel.INFO, true);
  DEFAULT_CONFIG.internalApiKey = buf.toString("hex");
}

// Handle LND TLS error at the request level
const agent = new https.Agent({ rejectUnauthorized: false });

/**
 * Accessor for the api key
 * @returns - api key
 */
export const getInternalApiKey = (): string => {
  return globalApiKey;
};

/**
 * Hit the LND Node and see if it returns data
 * @param {string} host
 * @param {number} startTime
 */
async function testLnd(host: string, startTime: number): Promise<void> {
  const INFO = await axios.get(`${host}/v1/getinfo`, { httpsAgent: agent });
  log(
    `found lnd version: ${INFO.data.version.split("commit=")[0]}`,
    LogLevel.INFO,
    true
  );
  const END_TIME: number = new Date().getMilliseconds() - startTime;
  const REAL_TIME: number = END_TIME < 0 ? END_TIME * -1 : END_TIME;
  log(
    `gitpayd started in ${REAL_TIME}ms on ${os.hostname()}:${PORT}`,
    LogLevel.INFO,
    true
  );
}

/**
 * Check for a config file. If no config file
 * exists create some default values so we can
 * check for the LND node existing
 */
export default async function setup(): Promise<void> {
  const startTime: number = new Date().getMilliseconds();
  let config: ConfigFile | Buffer;
  try {
    config = await fsp.readFile(CONFIG_PATH);
  } catch {
    log("no config file found", LogLevel.ERROR, true);
    // none found, write it
    await generateInternalApkiKey().catch(() =>
      log(`failed to generate api key`, LogLevel.INFO, true)
    );
    await fsp
      .mkdir(`${os.homedir()}/.gitpayd/`)
      .catch(() => log(`path for config already exists`, LogLevel.INFO, true));
    await fsp
      .writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, INDENT))
      .catch(() => log("failed to write config file", LogLevel.INFO, true));
    config = await fsp.readFile(CONFIG_PATH);
  }
  // get macaroon from config file path
  const MACAROON: string = (
    await fsp.readFile(JSON.parse(config.toString()).macaroonPath)
  ).toString("hex");
  const INTERNAL_API_KEY: string = JSON.parse(config.toString()).internalApiKey;
  // set macaroon in axios header
  axios.defaults.headers.get["Grpc-Metadata-macaroon"] = MACAROON;
  axios.defaults.headers.post["Grpc-Metadata-macaroon"] = MACAROON;
  // api call to lnd node
  const LND_HOST: string = JSON.parse(config.toString()).lndHost;
  globalLndHost = LND_HOST;
  globalApiKey = INTERNAL_API_KEY;
  testLnd(LND_HOST, startTime).catch(() => {
    throw new Error("LND is not online. Exiting...");
  });
}

/**
 * Re-usable function for doing LND Stuff
 * @param {string} paymentRequest - invoice sent to gitpayd
 * @param {PaymentAction} action - decode, get the channel balance, or process payments
 */
export function handlePaymentAction(
  paymentRequest: string | null,
  action: PaymentAction
): Promise<AxiosResponse<any>> {
  switch (action) {
    // case for decoding payment
    case PaymentAction.DECODE:
      return axios.get(`${globalLndHost}/v1/payreq/${paymentRequest}`, {
        httpsAgent: agent,
      });
    // case for returning channel balance
    case PaymentAction.RETURN_BALANCE:
      return axios.get(`${globalLndHost}/v1/balance/channels`, {
        httpsAgent: agent,
      });
    // case for sending payment
    case PaymentAction.PAY:
      return axios.post(
        `${globalLndHost}/v1/channels/transactions`,
        { payment_request: paymentRequest },
        { httpsAgent: agent }
      );
    default:
      return axios.get(`${globalLndHost}/v1/getinfo`, { httpsAgent: agent });
  }
}
