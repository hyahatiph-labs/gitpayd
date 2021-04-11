import { promises as fsp } from "fs";
import log, { LogLevel } from "../util/logging";
import os from "os";
import { randomBytes } from "crypto";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import {
  API_KEY_SIZE,
  ConfigFile,
  CONFIG_PATH,
  DEFAULT_CONFIG,
  Error,
  INDENT,
  NodeInfo,
} from "./config";

export let lightning: any;
export let router: any;
let globalApiKey: string;

// grpc configuration

// Due to updated ECDSA generated tls.cert we need to let gprc know that
// we need to use that cipher suite otherwise there will be a handhsake
// error when we communicate with the lnd rpc server.
process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";

// We need to give the proto loader some extra options, otherwise the code won't
// fully work with lnd.
const LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

/**
 * Generate the internal api key
 * It is validated against Github secrets.API_KEY
 */
export async function generateInternalApkiKey(): Promise<void> {
  const BUFFER: Buffer = randomBytes(API_KEY_SIZE);
  log(`generated api key of length ${BUFFER.length}`, LogLevel.INFO, true);
  DEFAULT_CONFIG.internalApiKey = BUFFER.toString("hex");
}

/**
 * Accessor for the api key
 * @returns - api key
 */
export const getInternalApiKey = (): string => {
  return globalApiKey;
};

/**
 * Accessor for the grpc
 * @returns - grpc implementation
 */
export const getLrpc = (): any => {
  return lightning;
};

/**
 * Accessor for the grpc router
 * @returns - grpc router implementation
 */
export const getRouter = (): any => {
  return router;
};

/**
 * Hit the LND Node and see if it returns data
 * @param {string} host
 * @param {number} startTime
 */
async function testLnd(): Promise<void> {
  lightning.getInfo({}, (e: Error, r: NodeInfo) => {
    if (e) {
      log(`${e}`, LogLevel.ERROR, true);
    }
    log(`${r.version.split("commit=")[0]}`, LogLevel.DEBUG, true);
  });
}

/**
 * Check for a config file. If no config file
 * exists create some default values so we can
 * check for the LND node existing
 */
export default async function setup(): Promise<void> {
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
  // set config as JSON
  const JSON_CONFIG: ConfigFile = JSON.parse(config.toString());
  // setup with values from config
  globalApiKey = JSON_CONFIG.internalApiKey;
  await configureLndGrpc(JSON_CONFIG).catch(
    () => new Error("lnd grpc configuration failed")
  );
}

/**
 * Helper function for configuring grpc
 * @param config - config file
 */
async function configureLndGrpc(config: ConfigFile) {
  const RPC_PROTO_PATH: string = config.rpcProtoPath;
  const ROUTER_PROTO_PATH: string = config.routerProtoPath;
  const LND_HOST: string = config.lndHost;
  log(`rpc proto path is ${RPC_PROTO_PATH}`, LogLevel.DEBUG, false);
  log(`router proto path is ${ROUTER_PROTO_PATH}`, LogLevel.DEBUG, false);
  const RPC_PACKAGE_DEF: protoLoader.PackageDefinition = protoLoader.loadSync(
    RPC_PROTO_PATH,
    LOADER_OPTIONS
  );
  const ROUTER_PACKAGE_DEFINITION = protoLoader.loadSync(
    [RPC_PROTO_PATH, ROUTER_PROTO_PATH],
    LOADER_OPTIONS
  );
  const LND_CERT: Buffer = await fsp.readFile(config.tlsPath);
  const MACAROON: string = (await fsp.readFile(config.macaroonPath)).toString(
    "hex"
  );
  // build meta data credentials
  const METADATA: grpc.Metadata = new grpc.Metadata();
  METADATA.add("macaroon", MACAROON);
  const MACAROON_CREDS: grpc.CallCredentials = grpc.credentials.createFromMetadataGenerator(
    (_args, callback) => {
      callback(null, METADATA);
    }
  );
  const LND_CREDENTIALS: grpc.ChannelCredentials = grpc.credentials.createSsl(
    LND_CERT
  );
  // combine the cert credentials and the macaroon auth credentials
  // such that every call is properly encrypted and authenticated
  const CREDENTIALS: grpc.ChannelCredentials = grpc.credentials.combineChannelCredentials(
    LND_CREDENTIALS,
    MACAROON_CREDS
  );
  const LNRPC_DESCRIPTOR: grpc.GrpcObject = grpc.loadPackageDefinition(
    RPC_PACKAGE_DEF
  );
  const LN_ROUTER_DESCRIPTOR: grpc.GrpcObject = grpc.loadPackageDefinition(
    ROUTER_PACKAGE_DEFINITION
  );
  // TODO: find out why any is needed here...
  const lnrpc: any = LNRPC_DESCRIPTOR.lnrpc;
  const lnrouter: any = LN_ROUTER_DESCRIPTOR.routerrpc;
  lightning = new lnrpc.Lightning(LND_HOST, CREDENTIALS);
  router = new lnrouter.Router(LND_HOST, CREDENTIALS);
  await testLnd().catch((e) => {
    // exit if lnd could not connect
    throw new Error(`${e}`);
  });
}
