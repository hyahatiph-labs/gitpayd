import express from 'express';
import setup, { getMacaroon, GitpaydConfig,
    handlePaymentAction, PaymentAction } from './setup';
import log, { LogLevel } from './logging';
const APP = express();

// TODO: automated cert renewal
// TODO: convert server to HTTPS

// check for lnd first
setup().catch(() => { throw new Error('gitpayd failed to initialize') });

// healthcheck for gitpayd
APP.get("/gitpayd/health", (req, res) => {
    log(`${req.ip} connected to gitpayd/health`, LogLevel.INFO, true);
    res.status(GitpaydConfig.HTTP_OK).json({ msg: 'gitpayd is UP' });
});

// decode payment API for gitpayd
APP.get("/gitpayd/decode/:paymentRequest", (req, res) => {
    const AUTH = req.headers.authorization;
    if(AUTH !== getMacaroon()) {
        log(`${req.ip} unauthorized access on gitpayd/health`, LogLevel.ERROR, true);
        res.status(GitpaydConfig.SERVER_FAILURE).json({ msg: `bad creds: ${AUTH}` })
    } else {
        log(`${req.ip} connected to gitpayd/decode`, LogLevel.INFO, true);
        // decode the payment request with the lnd node
        handlePaymentAction(req.params.paymentRequest, PaymentAction.DECODE)
          .then(decoded => res.status(GitpaydConfig.HTTP_OK)
          .json({ amt: decoded.data.num_satoshis }))
          .catch(() => res.status(GitpaydConfig.SERVER_FAILURE)
          .json({msg: 'gitpayd failed to decode payment request' }));
    }
});

// validate channel balance API for gitpayd
APP.get("/gitpayd/balance", (req, res) => {
    const AUTH = req.headers.authorization;
    if(AUTH !== getMacaroon()) {
        log(`${req.ip} unauthorized access on gitpayd/balance`, LogLevel.ERROR, true);
        res.status(GitpaydConfig.SERVER_FAILURE).json({ msg: `bad creds: ${AUTH}` })
    } else {
        log(`${req.ip} connected to gitpayd/balance`, LogLevel.INFO, true);
        // send the payment request to the lnd node
        handlePaymentAction(null, PaymentAction.BALANCE)
          .then(balance => res.status(GitpaydConfig.HTTP_OK)
          .json({ balance: balance.data.local_balance }))
          .catch(() => res.status(GitpaydConfig.SERVER_FAILURE)
          .json({ msg: 'gitpayd failed to send payment' }));
    }
});

// send payment API for gitpayd
APP.post("/gitpayd/pay/:paymentRequest", (req, res) => {
    const AUTH = req.headers.authorization;
    if(AUTH !== getMacaroon()) {
        res.status(GitpaydConfig.SERVER_FAILURE).json({msg: `bad creds: ${AUTH}`})
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

// start the Express server
APP.listen(GitpaydConfig.PORT, GitpaydConfig.HOST, () => { /* do nothing*/ });