import axios, { AxiosResponse } from "axios";
import https from "https";
import { promises as fsp } from "fs";
import log, { LogLevel } from "../util/logging";
import os from "os";
import { randomBytes } from "crypto";
import {
  API_KEY_SIZE,
  ConfigFile,
  CONFIG_PATH,
  DEFAULT_CONFIG,
  INDENT,
  PORT,
} from "./config";

let globalLndHost: string;
let globalApiKey: string;

/**
 * Generate the internal api key
 * It is validated against Github secrets.API_KEY
 */
export async function generateInternalApkiKey(): Promise<void> {
  const BUFFER: Buffer = randomBytes(API_KEY_SIZE);
  log(`generated api key of length ${BUFFER.length}`, LogLevel.INFO, true);
  DEFAULT_CONFIG.internalApiKey = BUFFER.toString("hex");
}

// Handle LND TLS error at the request level
export const agent = new https.Agent({ rejectUnauthorized: false });

/**
 * Accessor for the api key
 * @returns - api key
 */
export const getInternalApiKey = (): string => {
  return globalApiKey;
};

/**
 * Accessor for the LND HOST
 * @returns - lnd host
 */
 export const getLndHost = (): string => {
  return globalLndHost;
};

/**
 * Hit the LND Node and see if it returns data
 * @param {string} host
 * @param {number} startTime
 */
async function testLnd(host: string, startTime: number): Promise<void> {
  let nodeInfo: AxiosResponse<any>;
  await axios.get(`${host}/v1/getinfo`, { httpsAgent: agent })
    .then(res => nodeInfo = res)
    .catch(() => log("LND failed to connect", LogLevel.ERROR, true));
  log(
    `found lnd version: ${nodeInfo.data.version.split("commit=")[0]}`,
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
    // exit if lnd could not connect
    throw new Error('could not connect to LND');
  });
}