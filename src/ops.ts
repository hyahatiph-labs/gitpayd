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
const splitter = (str:string[]) => {
    return str[1] !== undefined ? str[1].split('\n')[0].trim() : null;
}

/**
 * Make the API call to LND for processing payments
 * @param {String} paymentRequest
 * @param {Number} amount
 */
async function sendPayment(paymentRequest:string, amount:string):Promise<void> {
    // send the payment

    // merge the pr with github cli spawned process
}

/**
 * This function acquires the issue linked in the pull request
 */
async function acquireIssues():Promise<void> {
    const pr = await axios.get(`${API}/${OWNER}/${REPO}/pulls`);
    pr.data.forEach(async (pull:any) => {
        const ISSUE_NUM:string = splitter(pull.body.split('Closes #'));
        // const PAYMENT_REQUEST = splitter(pull.body.split('LN:'));
        const PULL_NUM = pull.number;
        if(ISSUE_NUM) {
            log(`Processing issue #${ISSUE_NUM}...`, LogLevel.INFO);
            const issue = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/issues/${ISSUE_NUM}`);
            const AMT = splitter(issue.data.body.split('Bounty: '));
            log(`Attempting to automatically merge pull request #${PULL_NUM} for ${AMT} satoshis`, LogLevel.INFO);
            // sendPayment(PAYMENT_REQUEST, AMT).catch(e => console.info(e));
        }
    })
}

acquireIssues().catch(() => log('failed to process issues', LogLevel.ERROR));