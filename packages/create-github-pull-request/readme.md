# create-github-pull-request

Update a file on github and create a pull request for it


## Installation

Grab it from npm

```shell
npm install create-github-pull-request
```

## Usage

```js
const createGithubPullRequest = require('create-github-pull-request');
createGithubPullRequest(
  'nerdlabs/create-github-pull-request/package.json',
  new Buffer('file content')
).then(link => console.log('link to PR:', link));
```

## Parameters
`createGithubPullRequest(uri: string, content: Buffer, options?: Options): Promise<string>`

**uri**: A string to identify a file in a github repository
  `user/repo/path/to/file.txt`

**content**: The updated content of the file

**options**:
  * **auth**: [authentication object](https://github.com/mikedeboer/node-github#authentication)
  * **branch**: specify a different branch than the repository's `default_branch` (usually master)
  * **message**: specify an alternative commit message / PR title and body.
    The subject line of the message will be used as title for the PR.
  * **client**: an instance of the [github client](https://github.com/mikedeboer/node-github).

---
Built by (c) nerdlabs. Released under the MIT license.
