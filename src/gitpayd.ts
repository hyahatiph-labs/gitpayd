import express from 'express';
import setup, { GitpaydConfig } from './setup';
import log, { LogLevel } from './logging';
const APP = express();
const HTTP_OK = 200;

// TODO: automated cert renewal
// TODO: convert server to HTTPS

// check for lnd first
setup();

// healthcheck for gitpayd
APP.get("/gitpayd/health", (req, res) => {
    log(`${req.ip} connected to gitpayd/health`, LogLevel.INFO);
    res.status(HTTP_OK).json({msg: 'gitpayd is UP'});
});

// payment API for gitpayd
APP.post("/gitpayd/pay:paymentRequest", (req, res) => {
    log(`${req.ip} connected to gitpayd/pay`, LogLevel.INFO);
    // send the payment request to the lnd node
    // sendPayment();
    res.status(HTTP_OK).json({msg: ''});
});

// start the Express server
APP.listen(GitpaydConfig.PORT, () => { /* do nothing*/ });