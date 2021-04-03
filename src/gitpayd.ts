#!/usr/bin/env node
import express from 'express';
import log, { LogLevel } from './logging';
import https from 'https';
import fs from 'fs';
import {
    CONFIG_PATH, GitpaydConfig, PaymentAction,
    KEY_PATH, CERT_PATH, CA_PATH,
    ROOT_PATH, PORT, IP, SCHEMA
} from './config';
import setup, { getInternalApiKey, handlePaymentAction } from './setup';
import prompt from 'prompt';

let passphrase: string;

const APP = express();

// healthcheck for gitpayd
APP.get("/gitpayd/health", (req, res) => {
    log(`${req.ip} connected to gitpayd/health`, LogLevel.INFO, true);
    res.status(GitpaydConfig.HTTP_OK).json({ msg: 'gitpayd is UP' });
});

// decode payment API for gitpayd
APP.get("/gitpayd/decode/:paymentRequest", (req, res) => {
    const AUTH = req.headers.authorization;
    if (AUTH !== getInternalApiKey()) {
        log(`${req.ip} unauthorized access on gitpayd/decode`, LogLevel.ERROR, true);
        res.status(GitpaydConfig.UNAUTHORIZED).json({ msg: `bad creds: ${AUTH}` })
    } else {
        log(`${req.ip} connected to gitpayd/decode`, LogLevel.INFO, true);
        // decode the payment request with the lnd node
        handlePaymentAction(req.params.paymentRequest, PaymentAction.DECODE)
            .then(decoded => res.status(GitpaydConfig.HTTP_OK)
                .json({ amt: decoded.data.num_satoshis }))
            .catch(() => res.status(GitpaydConfig.SERVER_FAILURE)
                .json({ msg: 'gitpayd failed to decode payment request' }));
    }
});

// validate channel balance API for gitpayd
APP.get("/gitpayd/balance", (req, res) => {
    const AUTH = req.headers.authorization;
    if (AUTH !== getInternalApiKey()) {
        log(`${req.ip} unauthorized access on gitpayd/balance`, LogLevel.ERROR, true);
        res.status(GitpaydConfig.UNAUTHORIZED).json({ msg: `bad creds: ${AUTH}` })
    } else {
        log(`${req.ip} connected to gitpayd/balance`, LogLevel.INFO, true);
        // send the payment request to the lnd node
        handlePaymentAction(null, PaymentAction.BALANCE)
            .then(balance => res.status(GitpaydConfig.HTTP_OK)
                .json({ balance: balance.data.local_balance }))
            .catch(() => res.status(GitpaydConfig.SERVER_FAILURE)
                .json({ msg: 'gitpayd failed return balance' }));
    }
});

// send payment API for gitpayd
APP.post("/gitpayd/pay/:paymentRequest", (req, res) => {
    const AUTH = req.headers.authorization;
    log(`${getInternalApiKey()}`, LogLevel.DEBUG, false);
    if (AUTH !== getInternalApiKey()) {
        res.status(GitpaydConfig.UNAUTHORIZED).json({ msg: `bad creds: ${AUTH}` })
    } else {
        log(`${req.ip} connected to gitpayd/pay`, LogLevel.INFO, true);
        // send the payment request to the lnd node
        handlePaymentAction(req.params.paymentRequest, PaymentAction.PAY)
            .then(pay => res.status(GitpaydConfig.HTTP_OK)
                .json({ image: pay.data.payment_preimage }))
            .catch(() => res.status(GitpaydConfig.SERVER_FAILURE)
                .json({ msg: 'gitpayd failed to send payment' }));
    }
});

/**
 * Drive server initialization with SSL passphrase
 */
async function initialize(): Promise<void> {
    // get ssl passphrase on startup
    prompt.start();
    let {sslpassphrase} = await prompt.get(SCHEMA);
    passphrase = sslpassphrase.toString();
    // start the gitpayd server
    try {
        const HTTPS_SERVER = https.createServer({
            key: fs.readFileSync(KEY_PATH),
            passphrase,
            cert: fs.readFileSync(CERT_PATH),
            ca: [fs.readFileSync(CA_PATH), fs.readFileSync(ROOT_PATH)]
        }, APP);
        HTTPS_SERVER.listen(PORT, IP);
    // check for lnd node
    setup().catch(() => log(`setup failed, check ${CONFIG_PATH}`, LogLevel.ERROR, true));
    // clear ssl passphrase
    passphrase = null;
    sslpassphrase = null;
    } catch {
        log('https is not configured, check ssl certs location or passphrase', LogLevel.ERROR, true);
    }
}

initialize();