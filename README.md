# gitpayd

[![Build](https://github.com/reemuru/gitpayd/actions/workflows/build.yml/badge.svg)](https://github.com/reemuru/gitpayd/actions/workflows/build.yml)

[![gitpayd](https://snyk.io/advisor/npm-package/gitpayd/badge.svg)](https://snyk.io/advisor/npm-package/gitpayd)

Github Workflows + [BTC](https://bitcoin.org/en/bitcoin-core) / [LND](https://github.com/lightningnetwork/lnd), gitpayd watches your repo for new commits and sends payments to contributors

![image](https://user-images.githubusercontent.com/13033037/113526005-2262f900-9586-11eb-99d2-93ec47c03ded.png)


```bash
[INFO]  2021-04-05T00:34:10.007Z => found lnd version: 0.12.0-beta.rc1 
[INFO]  2021-04-05T00:34:10.010Z => gitpayd started in 849ms on SERVER:7777
[INFO]  2021-04-05T00:36:41.376Z => x.x.x.x connected to gitpayd/health
[INFO]  2021-04-05T00:36:41.598Z => x.x.x.x connected to gitpayd/noops
[INFO]  2021-04-05T00:36:41.707Z => processing issue #13...
[INFO]  2021-04-05T00:36:41.779Z => attempting to settle pull request #14 for 150 sats
[INFO]  2021-04-05T00:36:41.890Z => payment amount decoded: 100 sats
[ERROR] 2021-04-05T00:36:41.892Z => decoded amount does not match bounty!
[INFO]  2021-04-05T00:38:07.507Z => x.x.x.x connected to gitpayd/health
[INFO]  2021-04-05T00:38:07.590Z => x.x.x.x connected to gitpayd/noops
[INFO]  2021-04-05T00:38:07.702Z => processing issue #13...
[INFO]  2021-04-05T00:38:07.772Z => attempting to settle pull request #14 for 100 sats
[INFO]  2021-04-05T00:38:07.869Z => payment amount decoded: 100 sats
[INFO]  2021-04-05T00:38:07.944Z => gitpayd channel balance is: 484976 sats
[INFO]  2021-04-05T00:38:08.926Z => Pull Request successfully merged
[INFO]  2021-04-05T00:38:13.092Z => payment pre-image: L2wHWnourzWsAsH0F3f2GKxDYilTUzNEavdhk6MKqF8=

```
*** <b>Caution</b>: This application is beta and breaking changes may occur. Use mainnet at your own risk!

## Project Layout

```bash
gitpayd/
├── src                # Directory of source code
   ├── config.ts         # Configuration properties
   ├── gitpayd.ts        # Entry point for the app
   ├── logging.ts        # In house logger, since TS hates console.log()
   ├── noops.ts          # NoOps / DevOps script for processing CI / CD payments
   ├── setup.ts          # Creates configuration, connects to LND, helper functions, etc.
├── test               # Test files
├── util               # Helper functions
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
<br/>

```bash
Options:
      --help                     Show help                             [boolean]
      --version                  Show version number                   [boolean]
      --key-path, --kp           Path to SSL private key     [string] [required]
      --cert-path, --cep         Path to the server certification
                                                             [string] [required]
      --ca-path, --cap           Path to the CA intermediate certification
                                                             [string] [required]
      --root-path, --rp          Path to the root intermediate certification
                                                             [string] [required]
  -p, --port                     port to run the server                 [number]
      --dev-port, --dvp          dev port to run the server             [number]
  -o, --owner                    owner of the repo NoOps is running
                                                             [string] [required]
  -r, --repo                     name of the repo NoOps is running
                                                             [string] [required]
      --max-pay, --mp            maximum allowable payment              [string]
      --payment-threshold, --pt  minimum channel balance to maintain    [string]

```
## Security

1. API key is generated at setup, protect or configure your own
2. Pull Requests are validated against OWNER and COLLABORATOR author associations.
3. Payment thresholds are configured in command line.
4. SSL certs / passphrase is required to start the https server (self-signed should be fine).
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
<li>GITPAYD_HOST - host of your server
<li>GITPAYD_PORT - port of your server
<li>GITHUB_TOKEN*** - configured automatically for each build
<li>API_KEY - default is automatically <b>generated at setup in ~/.gitpayd/config.json</b>
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
3. Execute from workflow as curl or create your own action thingy!

```bash
# gitpayd-cli required arguments
gitpayd --cap=/home/USER/path-to-ca-cert/ca.crt --kp=/home/USER/path-to-private-key/PRIVATEKEY.key --cep=/home/USER/path-server-cert/server.crt --rp=/home/USER/path-to-root-cert/root.crt --o=owner -r=repo
# optional arguments -p=PORT, -host=IP_ADDRESS --dvp=DEV_PORT --ll=DEBUG,INFO,ERROR (default is INFO,ERROR)
```

## Releasing

TODO: Automated release management via `npm publish` and workflows

## Testing

`npm test`
<br/>
more tests are encouraged

## Contributing
Suggested Merge Flow:

developer branch => PR for dev branch => PR for release/v.X.X.X branch => PR merge to main branch
