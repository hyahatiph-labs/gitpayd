'use strict'
const axios = require('axios')
const api = 'https://api.github.com/repos'
const owner = process.argv[2]
const repo = process.argv[3]
let paymentRequest;
let amount;

// set accept in axios header
axios.defaults.headers.get['Accept'] = 'application/vnd.github.v3+json';

/**
 * Helper function for parsing values from github metadata
 * @param {String} str 
 * @returns 
 */
const splitter = (str) => { return str[1].split('\n')[0].trim() }

/**
 * Make the API call to LND for processing payments
 * @param {String} paymentRequest 
 * @param {Number} amount 
 */
async function sendPayment(paymentRequest, amount) {
    // send the payment
    
    // merge the pr with github cli spawned process
}

/**
 * This function acquires the issue linked in the pull request
 */
async function acquireIssues() {
    const pr = await axios.get(`${api}/${owner}/${repo}/pulls`)
    pr.data.forEach(async pull => {
        const issueNum = splitter(pull.body.split('Closes #'))
        paymentRequest = splitter(pull.body.split('LN: '))
        const pullRequestNum = pull.number
        console.log(`Processing issue #${issueNum}...`)
        const issue = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}`)
        amount = splitter(issue.data.body.split('Bounty: '))
        console.log(`Attempting to automatically merge pull request #${pullRequestNum} for ${bounty} satoshis`)
        sendPayment(paymentRequest, amount).catch(e => console.info(e))
    })
}

acquireIssues().catch(e => console.info(e))