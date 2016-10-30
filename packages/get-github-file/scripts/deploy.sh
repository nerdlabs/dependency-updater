#!/usr/bin/env bash

git config --global user.email "builds@travis-ci.com"
git config --global user.name "Travis CI"
npm version prerelease
git push && git push --tags
npm publish --tag=canary
