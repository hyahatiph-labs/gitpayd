#!/usr/bin/env node
import express from "express";
import log, { LogLevel } from "./logging";
import https from "https";
import http from "http";
import fs from "fs";
import helmet from "helmet";
import {
  CONFIG_PATH,
  GitpaydConfig,
  KEY_PATH,
  CERT_PATH,
  CA_PATH,
  ROOT_PATH,
  PORT,
  HOST,
  GITPAYD_ENV,
  DEV_PORT,
  SSL_SCHEMA,
  GitpaydMode,
} from "./config";
import setup, { getInternalApiKey } from "./setup";
import prompt from "prompt";
import { runNoOps } from "./noops";
import { logStartup } from "./util";

let passphrase: string;
let isConfigured: boolean;

const APP = express();
const START_TIME: number = new Date().getMilliseconds();

// add helmet for hardening
APP.use(helmet({
  frameguard: {
    action: 'deny'
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ['style.com'],
    }
  },
  dnsPrefetchControl: false
}));

// healthcheck for gitpayd
APP.get("/gitpayd/health", (req, res) => {
  log(`${req.ip} connected to gitpayd/health`, LogLevel.INFO, true);
  res.status(GitpaydConfig.HTTP_OK).json({ msg: "gitpayd is UP" });
});

// NoOps for gitpayd
APP.post("/gitpayd/noops", (req, res) => {
  log(`${req.ip} connected to gitpayd/noops`, LogLevel.INFO, true);
  const AUTH = req.headers.authorization;
  const GITHUB_TOKEN = req.header("github-token");
  if (AUTH !== getInternalApiKey()) {
    log(`${req.ip} unauthorized access on gitpayd/noops`, LogLevel.ERROR, true);
    res.status(GitpaydConfig.UNAUTHORIZED).json({ msg: `bad creds: ${AUTH}` });
  } else {
    runNoOps(GITHUB_TOKEN).catch(() => {
      log(`An error occurred during NoOps`, LogLevel.ERROR, true);
    });
    res.status(GitpaydConfig.HTTP_OK).json({ msg: `NoOps Completed` });
  }
});

/**
 * Attempts to start the server in DEV mode
 * GITPAYD_ENV=DEV must be set
 */
const startHttp = (): void => {
  // set the dev server to run if environment variable is set
  if (GITPAYD_ENV === GitpaydConfig.DEV) {
    // check for lnd node
    if (!isConfigured) {
      setup().catch((e) => {
        log(`${e}`, LogLevel.DEBUG, true)
        log(`setup failed, check ${CONFIG_PATH}`, LogLevel.ERROR, true)
      });
    }
    const HTTP_SERVER = http.createServer(APP);
    HTTP_SERVER.listen(DEV_PORT, HOST);
    log("warning: gitpayd development server is running", LogLevel.INFO, true);
  }
  log(
    "https is not configured, check ssl certs location or passphrase",
    LogLevel.ERROR,
    true
  );
};

/**
 * Attempts to start the server with SSL info
 * @param input - SSL private key passphrase
 */
const startHttps = (input: string): void => {
  const HTTPS_SERVER = https.createServer(
    {
      key: fs.readFileSync(KEY_PATH),
      passphrase: input,
      cert: fs.readFileSync(CERT_PATH),
      ca: [fs.readFileSync(CA_PATH), fs.readFileSync(ROOT_PATH)],
    },
    APP
  );
  HTTPS_SERVER.listen(PORT, HOST);
  // check for lnd node
  setup().catch(() =>
    log(`setup failed, check ${CONFIG_PATH}`, LogLevel.ERROR, true)
  );
  isConfigured = true;
};


/**
 * Drive server initialization with SSL passphrase
 */
async function initialize(): Promise<void> {
  // get ssl passphrase on startup
  prompt.start();
  let { sslpassphrase } = await prompt.get(SSL_SCHEMA);
  passphrase = sslpassphrase.toString();
  // start the gitpayd server
  try {
    startHttps(passphrase);
    // clear ssl passphrase
    passphrase = null;
    sslpassphrase = null;
    await logStartup(PORT, GitpaydMode.SECURE, START_TIME);
  } catch {
    startHttp();
    if(GITPAYD_ENV) {
      await logStartup(DEV_PORT, GitpaydMode.UNSECURE, START_TIME);
    }
  }
}

initialize().catch(() =>
  log("gitpayd failed to initialize", LogLevel.ERROR, false)
);
