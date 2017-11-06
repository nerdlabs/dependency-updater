#!/usr/bin/env node

import { inspect } from 'util';
import { dirname } from 'path';
import nodeGlob from 'glob';
import denodeify from 'denodeify';
import semver from 'semver';
import latestVersion from 'latest-version';
import writePkg from 'write-pkg';
import loadJson from 'load-json-file';

const glob = denodeify(nodeGlob);

async function fetchLatestVersions(dependencies, type) {
    return await Promise.all(
        Object.keys(dependencies).map(async name => {
            try {
                const latest = await latestVersion(name);
                return { name, type, current: dependencies[name], latest };
            } catch (error) {
                console.warn(error);
            }
            return [];
        }),
    );
}

async function parsePackageFiles(manifestPath) {
    const path = dirname(manifestPath);
    const manifest = await loadJson(manifestPath);
    return { path, manifestPath, manifest };
}

async function getPackageUpdates(packageConfigPromise) {
    const packageConfig = await packageConfigPromise;
    const { dependencies = {}, devDependencies = {} } = packageConfig.manifest;
    const [latestDependencies, latestDevDependencies] = await Promise.all([
        fetchLatestVersions(dependencies, 'dependencies'),
        fetchLatestVersions(devDependencies, 'devDependencies'),
    ]);
    const updates = [
        ...latestDependencies,
        ...latestDevDependencies,
    ].filter(({ current, latest }) => needsUpdate(current, latest));
    return Object.assign({ updates }, packageConfig);
}

async function updateManifests(packageConfigPromise) {
    const packageConfig = await packageConfigPromise;
    const newManifest = Object.assign({}, packageConfig.manifest);
    for (let { type, name, current, latest } of packageConfig.updates) {
        newManifest[type][name] = `${getSavePrefix(current)}${latest}`;
    }
    await writePkg(packageConfig.manifestPath, newManifest);
    return packageConfig;
}

function needsUpdate(current, latest) {
    return (
        Boolean(semver.validRange(current)) &&
        semver.gtr(latest, current) &&
        !semver.satisfies(latest, current)
    );
}

function getSavePrefix(current) {
    return current.startsWith('^') ? '^' : current.startsWith('~') ? '~' : '';
}

async function main() {
    const manifests = await glob('**/package.json', {
        ignore: '**/node_modules/**',
    });

    return await Promise.all(
        manifests
            .map(parsePackageFiles)
            .map(getPackageUpdates)
            .map(updateManifests),
    );
}

main()
    .then(packages =>
        console.log(inspect(packages, { colors: true, depth: 3 })),
    )
    .catch(console.log.bind(console, '\n\nError!\n\n'));
