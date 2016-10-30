#!/usr/bin/env bash

npm version prerelease
npm publish --tag=canary
