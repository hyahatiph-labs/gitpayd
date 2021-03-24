'use strict'
import axios from 'axios';
import log, { LogLevel } from './logging';
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
const splitter = (body:string, delimiter:string):string => {
    const preParse = body.split(delimiter);
    return preParse[1] !== undefined ? preParse[1].split('\n')[0].trim() : null;
}

/**
 * Make the API call to LND for processing payments
 * @param {String} paymentRequest
 * @param {Number} amount
 */
async function sendPayment(paymentRequest:string, amount:string):Promise<void> {
    // send the payment

    // merge the pr with github api
}

/**
 * This function acquires the issue linked in the pull request
 */
async function acquireIssues():Promise<void> {
    const pr = await axios.get(`${API}/${OWNER}/${REPO}/pulls`);
    pr.data.forEach(async (pull:any) => {
        const ISSUE_NUM :string | null = splitter(pull.body, 'Closes #');
        const PAYMENT_REQUEST:string = splitter(pull.body, 'LN:');
        const PULL_NUM:number = pull.number;
        if(ISSUE_NUM && PAYMENT_REQUEST) {
            log(`Processing issue #${ISSUE_NUM}...`, LogLevel.INFO);
            const issue = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/issues/${ISSUE_NUM}`);
            const AMT:string | null = splitter(issue.data.body, 'Bounty: ');
            log(`Attempting to automatically merge pull request #${PULL_NUM} for ${AMT} satoshis`, LogLevel.INFO);
            if(AMT) {
                sendPayment(PAYMENT_REQUEST, AMT).catch(() => log('failed to send payment', LogLevel.ERROR));
            }
        }
    })
}

acquireIssues().catch(() => log('failed to process issues', LogLevel.ERROR));