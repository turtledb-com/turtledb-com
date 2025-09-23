# turtledb-com

The easiest way to build a web app.

> [!WARNING] 
> THIS PROJECT IS A WORK IN PROGRESS

## A Reinvented Internet

* This project takes your directories and puts them on the web.
* It distributes and remembers your changes as you make them.

## Getting Started

0. have a growth mindset
0. install node [^1]
0. make a directory for your new web-site
0. open a terminal and `cd` to your directory [~1]
0. run `npx turtledb-com -f -r` and answer the questions
0. add some .html to your directory (and .css and .js if you want (and maybe some images?)) [^1]
0. see your amazing website online (and wow your friends)

[^1]: you can do it! I believe in you! (but if a step takes more than 10 minutes of "how do I open a terminal on windows?" please let me know. (let's improve some documentation))

## command line options

`npx turtledb-com -h`

> Usage: turtledb-com [options]
> 
> Options:
| flags | description |
|---|---|
| -V, --version                    | output the version number |
| --env-file <path>                | path to .env file |
| --username <string>              | username to use for Signer (env: TURTLEDB_USERNAME) |
| --password <string>              | password to use for Signer (env: TURTLEDB_PASSWORD) |
| --turtlename <string>            | name for dataset (env: TURTLEDB_TURTLENAME) |
| -f, --fs-mirror [resolve]        | mirror files locally and handle (choices: "ours", "theirs", "throw", "", default: false, preset: "throw", env: TURTLEDB_FS_MIRROR) |
| -i, --interactive                | flag to start repl (default: false, env: TURTLEDB_INTERACTIVE) |
| -a, --archive                    | save all turtles to files by public key (default: false, env: TURTLEDB_ARCHIVE) |
| -v, --verbose [level]            | log data flows (choices: "-Infinity", "-3", "-2", "-1", "0", "1", "2", "3", "Infinity", default: 0, preset: 1, env: TURTLEDB_VERBOSE) |
| -w, --web-port [number]          | web port to sync from (default: false, preset: 8080, env: TURTLEDB_WEB_PORT) |
| --web-fallback <string>          | project public key to use as fallback for web (env: TURTLEDB_WEB_FALLBACK) |
| --web-certpath <string>          | path to self-cert for web (env: TURTLEDB_WEB_CERTPATH) |
| --web-insecure                   | (local dev) allow unauthorized for web (env: TURTLEDB_WEB_INSECURE) |
| --remote-host <string>           | remote host to sync to (default: false, env: TURTLEDB_REMOTE_HOST) |
| -r, --remote-port [number]       | remote port to sync to (default: false, preset: 1024, env: TURTLEDB_REMOTE_PORT) |
| -l, --local-port [number]        | local port to sync from (default: false, preset: 1024, env: TURTLEDB_LOCAL_PORT) |
| --s3-end-point <string>          | endpoint for s3 (like "https://sfo3.digitaloceanspaces.com") (default: false, env: TURTLEDB_S3_END_POINT) |
| --s3-region <string>             | region for s3 (like "sfo3") (env: TURTLEDB_S3_REGION) |
| --s3-access-key-id <string>      | accessKeyId for s3 (env: TURTLEDB_S3_ACCESS_KEY_ID) |
| --s3-secret-access-key <string>  | secretAccessKey for s3 (env: TURTLEDB_S3_SECRET_ACCESS_KEY) |
| --s3-bucket <string>             | bucket for s3 (env: TURTLEDB_S3_BUCKET) |
| -h, --help                       | display help for command |