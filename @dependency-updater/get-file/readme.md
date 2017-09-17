# get-github-file

Get a file from a github repository


## Installation

Grab it from npm

```shell
npm install get-github-file
```

## Usage

```js
const getGithubFile = require('get-github-file');
getGithubFile('nerdlabs/get-github-file/package.json')
  .then(buffer => console.log(buffer.toString('utf-8')));
```

## Parameters
`getGithubFile(uri: string, options?: Options): Promise<Buffer>`

**uri**: A string to identify a file in a github repository
  `user/repo/path/to/file.txt`

**options**:
  * **auth**: [authentication object](https://github.com/mikedeboer/node-github#authentication)
  * **branch**: specify a different branch than the repository's `default_branch` (usually master)
  * **client**: an instance of the [github client](https://github.com/mikedeboer/node-github).

---
Built by (c) nerdlabs. Released under the MIT license.
