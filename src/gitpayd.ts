import express from 'express';
import setup from './setup';
import log from './logging';
import { LogLevel } from './logging';
const APP = express();
const PORT = 7777; // default port to listen
const HTTP_OK = 200;

// check for lnd first
setup();

// healthcheck for gitpayd
APP.get("/gitpayd/health", (req, res) => {
    log(`${req.ip} connected to gitpayd`, LogLevel.INFO);
    res.status(HTTP_OK).json({msg: 'gitpayd is UP'});
});

// start the Express server
APP.listen(PORT, () => {
    log(`gipayd started at http://localhost:${PORT}`, LogLevel.INFO);
});