#!/usr/bin/env node
import axios from 'axios';
import { splitter, validateCollaborators } from '../util/util';
import log, { LogLevel } from './logging';
import { GitpaydConfig } from '../src/config'

const API: string = 'https://api.github.com/repos';
const OWNER: string = process.env.GITPAYD_OWNER;
const REPO: string = process.env.GITPAYD_REPO;
const HOST: string = process.env.GITPAYD_HOST;
const API_KEY: string = process.env.API_KEY;
const TOKEN = process.env.GITPAYD_TOKEN;
const HOST_URL: string = `https://${HOST}:/gitpayd`;
const TOKEN_HEADER: string = `token ${TOKEN}`;
const MERGE_BODY: object = { "commit_title": "merged by gitpayd" };
const CUSTOM_MAX_PAYMENT: number = parseInt(process.env.MAX_PAYMENT, 10);
const CUSTOM_PAYMENT_THRESHOLD: number = parseInt(process.env.MAX_PAYMENT, 10);
const MAX_PAYMENT: number  = CUSTOM_MAX_PAYMENT === undefined
    ? GitpaydConfig.DEFAULT_MAX_PAYMENT
    : CUSTOM_MAX_PAYMENT;
const PAYMENT_THRESHOLD: number  = CUSTOM_MAX_PAYMENT === undefined
    ? GitpaydConfig.DEFAULT_PAYMENT_THRESHOLD
    : CUSTOM_PAYMENT_THRESHOLD;

// set accept in axios header
axios.defaults.headers.get.Accept = 'application/vnd.github.v3+json';

/**
 * Helper function to warn user of misconfigured environment
 */
const validateEnv = (): void => {
    const ENV_SET: Set<string> = new Set([HOST, OWNER, REPO, TOKEN, API_KEY]);
    ENV_SET.forEach(v => {
        if (v === undefined || v === null || v === '') {
            throw new Error('noops environment variables are not configured')
        }
    });
}

/**
 * Make the API call to LND for processing payments
 * @param {string} paymentRequest - lnd invoice
 */
async function sendPayment(paymentRequest: string): Promise<void> {
    // send the payment
    const PRE_IMAGE =
    await axios.post(`${HOST_URL}/pay/${paymentRequest}`, {},
        { headers: { 'authorization': API_KEY } });
    log(`payment pre-image: ${PRE_IMAGE.data.image}`, LogLevel.INFO, false);
}

/**
 * Helper function for processing payment validity
 * @param {string} amount - bounty from the issue
 * @param {string} paymentRequest - lnd invoice
 */
 async function amtParser(amount: string, paymentRequest: string, pullNum: number): Promise<void> {
    // decode the payment request and make sure it matches bounty
    const DECODED_AMT =
        await axios.get(`${HOST_URL}/decode/${paymentRequest}`,
        {headers: {'authorization': API_KEY } });
    log(`payment amount decoded: ${DECODED_AMT.data.amt} sats`, LogLevel.DEBUG, false);
    if(DECODED_AMT.data.amt !== amount) {
        throw new Error('Decoded amount does not match bounty!')
    }
    const BALANCE = await axios.get(`${HOST_URL}/balance`,
        { headers: {'authorization': API_KEY } });
    log(`gitpayd channel balance is: ${BALANCE.data.balance.sat} sats`, LogLevel.DEBUG, false);
    // ensure the node has a high enough local balance to payout
    const NUM_AMT = parseInt(amount, 10);
    const isValidPayment = NUM_AMT > 0 && NUM_AMT < MAX_PAYMENT
        && (BALANCE.data.balance.sat >= NUM_AMT) && NUM_AMT < PAYMENT_THRESHOLD
    if(isValidPayment) {
        sendPayment(paymentRequest);
        const MERGE = await axios.put(`${API}/${OWNER}/${REPO}/pulls/${pullNum.toString()}/merge`,
                 MERGE_BODY, { headers: {'authorization': TOKEN_HEADER} });
            log(`${MERGE.data.message}`, LogLevel.INFO, false);
    } else {
        throw new Error('invalid valid payment');
    }

}

/**
 * This function acquires the issue linked in the pull request
 */
async function noOps(): Promise<void> {
    const PR = await axios.get(`${API}/${OWNER}/${REPO}/pulls?state=open`);
    PR.data.forEach(async (pull:any) => {
        const ISSUE_NUM: string | null = splitter(pull.body, 'Closes #');
        const PAYMENT_REQUEST: string | null = splitter(pull.body, 'LN:');
        const PULL_NUM: number = pull.number;
        const isCollaborator: boolean = validateCollaborators(pull.author_association);
        if (!isCollaborator) {
            throw new Error(`unauthorized collaborator ${pull.user.login} access on gitpayd`);
        }
        if(ISSUE_NUM && PAYMENT_REQUEST) {
            log(`Processing issue #${ISSUE_NUM}...`, LogLevel.INFO, false);
            const ISSUE = await axios.get(`${API}/${OWNER}/${REPO}/issues/${ISSUE_NUM}`);
            const AMT: string | null = splitter(ISSUE.data.body, 'Bounty: ');
            log(`Attempting to settle pull request #${PULL_NUM} for ${AMT} sats`, LogLevel.INFO, false);
            amtParser(AMT, PAYMENT_REQUEST, PULL_NUM);
        } else {
            log(`no pull requests are eligible`, LogLevel.INFO, true);
        }
    })
}

validateEnv();
noOps().catch(() => new Error('noops failed to execute'));