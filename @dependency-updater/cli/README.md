# dependency-updater

**Work in progress** not yet suitable for use

## Rationale
Project dependencies can quickly become outdated which, if not cared for,
can quickly build up technical debt and make it painful after a while to update.

This tool is inspired by [greenkeeper](https://greenkeeper.io/) and send you a
github pull request for updated dependencies.

By sending a pull request it will trigger your tests - and if they succeed you
can merge the changes with confidence.

This tool exists because *greenkeeper* does not currently support
mono-repositories and also because we believe that software should be free.

Plus: It's fun to learn new things and play around with lambda functions and
infrastructure as code.


## Prerequisites
Download and install:
* [Node.js and npm](https://nodejs.org/)
* [terraform](https://www.terraform.io/)


## Installation
execute
```shell
$ npm install
```
to install all required project dependencies.  

execute
```shell
$ npm run build
```
to compile the project  

execute
```shell
$ terraform plan
```
to see the list of changes that will be made

execute
```shell
$ terraform apply
```
to create the required infrastructure and the lambda function.


## Notes
* [terraform can use the credentials](https://www.terraform.io/docs/providers/aws/index.html#shared-credentials-file) that have been created by the [aws-cli](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html)
