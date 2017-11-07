const Url = require('url');
const packageJson = require('package-json');
const {
    default: LockFile,
    stringify: stringifyLockfile,
} = require('@yarnpkg/lockfile');

function normalizePattern(manifest, range) {
    const fullUrl = manifest.dist.tarball + '#' + manifest.dist.shasum;
    const registryUrl = Url.parse(fullUrl);
    registryUrl.host = registryUrl.hostname = 'registry.yarnpkg.com';

    manifest._reference = { permissions: {} };
    manifest._remote = { resolved: Url.format(registryUrl) };
    manifest.__semver_range = range;

    return manifest;
}

async function spreadPatterns(patternsPromise, [name, version]) {
    return [
        ...(await patternsPromise),
        ...(await createPatterns(name, version)),
    ];
}

async function createPatterns(name, version = 'latest') {
    const manifest = await packageJson(name, { version });
    const dependencies = Object.entries(manifest.dependencies || {});
    const pattern = normalizePattern(manifest, version);

    return dependencies.reduce(spreadPatterns, Promise.resolve([pattern]));
}

async function createLockfile(manifest) {
    const dependencies = Object.entries(manifest.dependencies || {});
    const patterns = (await dependencies.reduce(
        spreadPatterns,
        Promise.resolve([]),
    )).reduce(function(patterns, pattern) {
        patterns[`${pattern.name}@${pattern.__semver_range}`] = pattern;
        return patterns;
    }, {});

    const lockfile = new LockFile().getLockfile(patterns);

    return stringifyLockfile(lockfile);
}

module.exports = createLockfile;
