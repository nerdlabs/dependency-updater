#!/usr/bin/env bash

declare exitCode;


# -- [1] -------------------------------------------------------

$(npm bin)/travis-after-all
exitCode=$?


# -- [2] -------------------------------------------------------

if [ $exitCode -eq 0 ]; then
  git config --global user.email "builds@travis-ci.com"
	git config --global user.name "Travis CI"
	npm version prerelease
	git push && git push --tags
	npm publish --tag=canary
fi

if [ $exitCode -eq 1 ]; then
  echo "One or more travis jobs for this build failed."
fi
