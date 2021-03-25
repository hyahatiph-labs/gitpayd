'use strict'
import axios from 'axios';
import log, { LogLevel } from './logging';
import { GitpaydConfig } from './setup';
const API = 'https://api.github.com/repos';
const OWNER = process.argv[2];
const REPO = process.argv[3];

// set accept in axios header
axios.defaults.headers.get.Accept = 'application/vnd.github.v3+json';

/**
 * Helper function for parsing values from github metadata
 * @param {String} str
 * @returns String
 */
const splitter = (body:string, delimiter:string):string | null => {
    const PRE_PARSE = body.split(delimiter);
    return PRE_PARSE[1] !== undefined ? PRE_PARSE[1].split('\n')[0].trim() : null;
}

/**
 * Make the API call to LND for processing payments
 * @param {String} paymentRequest
 * @param {Number} amount
 */
async function sendPayment(paymentRequest:string, amount:string):Promise<void> {
    // const GITHUB_TOKEN:string = process.env.GITHUB_TOKEN;
    // send the payment

    // merge the pr with github api
    log('debugging sending payment', LogLevel.DEBUG, false);
}

/**
 * Helper function for processing payment validity
 * @param {String} amount
 * @param {String} paymentRequest
 * @returns String
 */
 async function amtParser(amount:string, paymentRequest:string):Promise<void> {
    // decode the payment request and make sure it matches bounty
    // TODO: change host and port to env variables and implement security
    const DECODED_AMT = await axios.get(`http://${GitpaydConfig.HOST}:${GitpaydConfig.PORT}/gitpayd/decode/${paymentRequest}`);
    log(`payment amount decoded: ${DECODED_AMT.data.amt} sats`, LogLevel.DEBUG, false);
    // TODO: add this check after dev work is complete
    // if(DECODED_AMT.data.amt !== amount) {
    //     log('payment request amount mismatch', LogLevel.ERROR, false);
    // }
    const BALANCE = await axios.get(`http://${GitpaydConfig.HOST}:${GitpaydConfig.PORT}/gitpayd/balance`);
    log(`gitpayd channel balance is: ${BALANCE.data.balance.sat} sats`, LogLevel.DEBUG, false);
    // ensure the node has a high enough local balance to payout
    const NUM_AMT = parseInt(amount, 10);
    if(NUM_AMT > 0 && NUM_AMT < GitpaydConfig.MAX_PAYMENT && (BALANCE.data.balance.sat >= NUM_AMT)) {
            sendPayment(paymentRequest, amount);
    }
}

/**
 * This function acquires the issue linked in the pull request
 */
async function acquireIssues():Promise<void> {
    const PR = await axios.get(`${API}/${OWNER}/${REPO}/pulls`);
    PR.data.forEach(async (pull:any) => {
        const ISSUE_NUM :string | null = splitter(pull.body, 'Closes #');
        const PAYMENT_REQUEST:string | null = splitter(pull.body, 'LN:');
        const PULL_NUM:number = pull.number;
        if(ISSUE_NUM && PAYMENT_REQUEST) {
            log(`Processing issue #${ISSUE_NUM}...`, LogLevel.INFO, false);
            const ISSUE = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/issues/${ISSUE_NUM}`);
            const AMT:string | null = splitter(ISSUE.data.body, 'Bounty: ');
            log(`Attempting to automatically merge pull request #${PULL_NUM} for ${AMT} satoshis`, LogLevel.INFO, false);
            amtParser(AMT, PAYMENT_REQUEST);
        }
    })
}

acquireIssues().catch(() => log('failed to process issues', LogLevel.ERROR, false));