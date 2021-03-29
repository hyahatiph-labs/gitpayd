import axios from 'axios';
import log, { LogLevel } from './logging';
import { GitpaydConfig } from './setup';
const API = 'https://api.github.com/repos';
const OWNER = process.env.GITPAYD_OWNER;
const REPO = process.env.GITPAYD_REPO;
const GITPAYD_HOST = `https://${process.env.GITPAYD_HOST}/gitpayd`;
const headers = { 'Authorization': process.env.API_KEY }

// set accept in axios header
axios.defaults.headers.get.Accept = 'application/vnd.github.v3+json';

/**
 * Helper function for parsing values from github metadata
 * @param {string} str - body from the api call
 * @param {string} delimiter - split on this
 * @returns String
 */
const splitter = (body:string, delimiter:string):string | null => {
    const PRE_PARSE = body.split(delimiter);
    return PRE_PARSE[1] !== undefined ? PRE_PARSE[1].split('\n')[0].trim() : null;
}

/**
 * Make the API call to LND for processing payments
 * @param {String} paymentRequest - lnd invoice
 */
async function sendPayment(paymentRequest:string):Promise<void> {
    // send the payment
    const PRE_IMAGE =
    await axios.post(`${GITPAYD_HOST}/pay/${paymentRequest}`, {}, {headers});
    log(`payment pre-image: ${PRE_IMAGE.data.image}`, LogLevel.INFO, false);
}

/**
 * Helper function for processing payment validity
 * @param {String} amount - bounty from the issue
 * @param {String} paymentRequest - lnd invoice
 * @returns String
 */
 async function amtParser(amount:string, paymentRequest:string):Promise<void> {
    // decode the payment request and make sure it matches bounty
    const DECODED_AMT =
    await axios.get(`${GITPAYD_HOST}/decode/${paymentRequest}`, {headers});
    log(`payment amount decoded: ${DECODED_AMT.data.amt} sats`, LogLevel.DEBUG, false);
    // TODO: add this check after dev work is complete
    // TODO: testing noops
    // if(DECODED_AMT.data.amt !== amount) {
    //     log('payment request amount mismatch', LogLevel.ERROR, false);
    // }
    const BALANCE = await axios.get(`${GITPAYD_HOST}/balance`, {headers});
    log(`gitpayd channel balance is: ${BALANCE.data.balance.sat} sats`, LogLevel.DEBUG, false);
    // ensure the node has a high enough local balance to payout
    const NUM_AMT = parseInt(amount, 10);
    if(NUM_AMT > 0 && NUM_AMT < GitpaydConfig.MAX_PAYMENT && (BALANCE.data.balance.sat >= NUM_AMT)) {
            sendPayment(paymentRequest);
    }
}

/**
 * This function acquires the issue linked in the pull request
 */
async function acquireIssues():Promise<void> {
    const PR = await axios.get(`${API}/${OWNER}/${REPO}/pulls`);
    PR.data.forEach(async (pull:any) => {
        const ISSUE_NUM:string | null = splitter(pull.body, 'Closes #');
        const PAYMENT_REQUEST:string | null = splitter(pull.body, 'LN:');
        const PULL_NUM:number = pull.number;
        if(ISSUE_NUM && PAYMENT_REQUEST) {
            log(`Processing issue #${ISSUE_NUM}...`, LogLevel.INFO, false);
            const ISSUE = await axios.get(`${API}/${OWNER}/${REPO}/issues/${ISSUE_NUM}`);
            const AMT:string | null = splitter(ISSUE.data.body, 'Bounty: ');
            log(`Attempting to automatically merge pull request #${PULL_NUM} for ${AMT} sats`, LogLevel.INFO, false);
            amtParser(AMT, PAYMENT_REQUEST);
        }
    })
}

acquireIssues().catch(e => {
    log(`${e}`, LogLevel.DEBUG, false);
    log('failed to process issues', LogLevel.ERROR, false)
});