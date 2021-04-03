# gitpayd

[![Build](https://github.com/reemuru/gitpayd/actions/workflows/build.yml/badge.svg)](https://github.com/reemuru/gitpayd/actions/workflows/build.yml)

Github Workflows + [BTC](https://bitcoin.org/en/bitcoin-core) / [LND](https://github.com/lightningnetwork/lnd), gitpayd watches your repo for new commits and sends payments to contributors

  

![image](https://user-images.githubusercontent.com/13033037/112792971-6e67e800-9032-11eb-96bb-79e5a460320c.png)

*** <b>Caution</b>: This application is beta and breaking changes may occur. Use mainnet at your own risk!

## Project Layout

```bash
gitpayd/
├── src                # Directory of source code
   ├── config.ts         # Configuration properties
   ├── gitpayd.ts        # Entry point for the app
   ├── logging.ts        # In house logger, since TS hates console.log()
   ├── setup.ts          # Creates configuration, connects to LND, helper functions, etc.
├── test               # Test files
├── util               # Helper functions
   ├── noops.ts          # NoOps / DevOps script for processing CI / CD payments
   ├── util.ts           # General purpose functions and logic for CI / CD
```

## Building

1. Run `npm i` to install modules
2. Run `npm run clean && npm run build`
3. Output is in `/dist`

## Development

1. Set environment variable `export GITPAYD_ENV=DEV` for development if needed
2. Run `node dist/src/gitpayd.js` to run server *--help for help 
3. Test health check at `http://hostname:7778/gitpayd/health` (*port 7777 is default secure port)
4. Verify configuration files at `~/.gitpayd/config.json`
5. Run `node dist/util/noop.js` to run NoOps script
<br/>

```bash
Options:
      --help              Show help                                    [boolean]
      --version           Show version number                          [boolean]
      --key-path, --kp    Path to SSL private key            [string] [required]
      --cert-path, --cep  Path to the server certification   [string] [required]
      --ca-path, --cap    Path to the CA intermediate certification
                                                             [string] [required]
      --root-path, --rp   Path to the root intermediate certification
                                                             [string] [required]
  -p, --port              port to run the server                        [number]

Missing required arguments: key-path, cert-path, ca-path, root-path
```
## Security

1. API key is generated at setup, protect or configure your own
2. Pull Requests are validated against OWNER and COLLABORATOR author associations.
3. Payment thresholds are configured in the enum GitpaydConfig or Environment variables.
4. SSL certs / passphrase is required to start the server (self-signed should be fine).
5. GITHUB_TOKEN runs at the repo level. Only authorized contributors are allowed.
6. It is possible to run dev and secure server concurrently with environment variable
   <b>$GITPAYD_ENV=DEV</b> set
<br/>

```bash
prompt: sslpassphrase:  
[ERROR] 2021-04-03T00:30:49.164Z => https is not configured, check ssl certs location or passphrase
[user@server gitpayd]$ 
```

## Notes
1. This application runs on the latest Node 12.x+
2. Currently, only battle tested on Fedora 34 Beta
4. Secrets can be configured in your repository `settings` => `secrets`
5. Sample Github workflow .yml is located in `gitpayd/.github/workflows/build.yml`

<b>Required Secrets</b>
<ul>
<li>GITPAYD_OWNER -  repo owner
<li>GITPAYD_REPO - name of repo to watch
<li>GITPAYD_HOST - host of your server
<li>GITPAYD_PORT - port of your server
<li>GITHUB_TOKEN*** is pre-configured for each repo
<li>API_KEY - default is automatically <b>generated at setup in ~/.gitpayd/config.json</b>
</ul>

<b>Optional Secrets</b>
<ul>
<li>MAX_PAYMENT - maximum allowable payment
<li>PAYMENT_THRESHOLD - minimum channel balance to maintain
</ul>

[GITHUB_TOKEN](https://docs.github.com/en/actions/reference/authentication-in-a-workflow)

<b>Sample .gitpayd/config.json</b>

```json 
{
 "macaroonPath": "/home/USER/.lnd/data/chain/bitcoin/mainnet/admin.macaroon",
 "lndHost": "https://localhost:8080",
 "internalApiKey": "xxx"
}
```

<b>Delimiters</b>
<ul>
<li> Issues should have a line <b>Bounty: amt</b> - where amt is the amount in satoshis
<li> Pull requests should have a line <b>LN: LNxxx</b> - where LNxxx is the invoice 
<li> as well as, <b>Closes #n</b> - where n is the issue number the pull request will close
</ul>

## Installation

1. Run `npm i -g gitpayd`
2. Execute `gitpayd` should start up the server
3. Install in the workflow and execute `noops`

```bash
# gitpayd-cli required arguments
gitpayd --cap=/home/USER/path-to-ca-cert/ca.crt --kp=/home/USER/path-to-private-key/PRIVATEKEY.key --cep=/home/USER/path-to-server-cert/server.crt --rp=/home/USER/path-to-root-cert/root.crt
# optional arguments -p=PORT, -host=IPADDRESS
```

## Releasing

TODO: Automated release management via `npm publish` and workflows

## Testing

`npm test`
<br/>
more tests are encouraged

## Contributing
TODO: formalized contributor guidelines