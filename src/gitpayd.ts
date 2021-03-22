import express from 'express';
import setup from './setup';
const APP = express();
const PORT = 7777; // default port to listen
const HTTP_OK = 200;

// check for lnd first
setup();

// healthcheck for gitpayd
APP.get("/gitpayd/health", (req, res) => {
    // TODO: build logging frameworks
    // tslint:disable-next-line:no-console
    console.log(`${req.ip} connected to gitpayd`);
    res.status(HTTP_OK).json({msg: 'gitpayd is UP'});
});

// start the Express server
APP.listen(PORT, () => {
    // TODO: build logging frameworks
    // tslint:disable-next-line:no-console
    console.log(`gipayd started at http://localhost:${PORT}`);
});