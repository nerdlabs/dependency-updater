import { basename, dirname, relative, sep as pathSeparator } from 'path';
import unindent from 'unindent';
import getGithubFile from '@dependency-updater/get-file';
import semver from 'semver';
import latestVersion from 'latest-version';
import Github from 'github';
import parseJson from 'parse-json';

exports.handler = function handler(event, context, callback) {
    main({
        auth: {
            type: 'basic',
            username: process.env.GITHUB_USER_NAME,
            password: process.env.GITHUB_PASSWORD,
        },
        user: process.env.GITHUB_REPO_OWNER,
        repo: process.env.GITHUB_REPO_NAME,
    })
        .then(result => callback(null, result))
        .catch(callback);
};

function ignoreNodeModules({ path }) {
    return !path.includes('node_modules');
}

function matchFile(fileName, { type, path }) {
    return type === 'blob' && basename(path) === fileName;
}

function matchManifest(item) {
    return matchFile('package.json', item);
}

function matchConfigFile(item) {
    return matchFile('.npmrc', item) || matchFile('.yarnrc', item);
}

function matchLockFile(item) {
    return (
        matchFile('yarn.lock', item) ||
        matchFile('package-lock.json', item) ||
        matchFile('npm-shrinkwrap.json', item)
    );
}

function matchOnlyParents(cwd) {
    return function(path) {
        const dir = dirname(path);
        return relative(cwd, dir)
            .split(pathSeparator)
            .every(x => x === '..' || x === '');
    };
}

function getBranchName(path) {
    return `update-dependencies-${path === '.' ? 'root' : path}`;
}

async function getLatestVersions(dependencies) {
    return (await Promise.all(
        Object.keys(dependencies).map(async name => {
            try {
                const current = dependencies[name];
                const latest = await latestVersion(name);
                if (
                    Boolean(semver.validRange(current)) &&
                    !semver.satisfies(latest, current)
                ) {
                    let currentRange = '';
                    if (current.startsWith('~')) {
                        currentRange = '~';
                    }
                    if (current.startsWith('^')) {
                        currentRange = '^';
                    }
                    return {
                        name,
                        current,
                        latest: `${currentRange}${latest}`,
                    };
                }
            } catch (error) {
                console.warn(error);
            }
            return null;
        }),
    )).filter(Boolean);
}

async function getUpdates(manifest) {
    const { dependencies = {}, devDependencies = {} } = manifest;
    const [latestDependencies, latestDevDependencies] = await Promise.all([
        getLatestVersions(dependencies),
        getLatestVersions(devDependencies),
    ]);
    return [
        ...latestDependencies.map(x => ((x.type = 'dependencies'), x)),
        ...latestDevDependencies.map(x => ((x.type = 'devDependencies'), x)),
    ];
}

async function main({ auth, user, repo }) {
    const client = new Github();
    client.authenticate(auth);

    const [
        { default_branch: defaultBranch },
        openPRs,
        { tree: rawTree },
    ] = await Promise.all([
        client.repos.get({ user, repo }),
        client.pullRequests.getAll({ user, repo, state: 'open' }),
        client.gitdata.getTree({ user, repo, sha: 'HEAD', recursive: true }),
    ]);

    const ourPRs = openPRs.filter(({ user }) => user.login === auth.username);
    const tree = rawTree.filter(ignoreNodeModules);
    const manifests = tree.filter(matchManifest).map(item => item.path);
    const configFiles = tree.filter(matchConfigFile).map(item => item.path);
    const lockFiles = tree.filter(matchLockFile).map(item => item.path);

    function getPackageConfig(path) {
        const dir = dirname(path);
        return {
            path: dir,
            manifestPath: path,
            configFiles: configFiles.filter(matchOnlyParents(dir)),
            lockFiles: lockFiles.filter(matchOnlyParents(dir)),
        };
    }

    function setBranchConfig(packageConfig) {
        const branchName = getBranchName(packageConfig.path);
        const headBranch = ourPRs.find(pr => pr.head.ref === branchName);

        return Object.assign({}, packageConfig, {
            baseBranch: defaultBranch,
            headBranch: headBranch ? headBranch.head.ref : null,
            prExists: Boolean(headBranch),
        });
    }

    async function parsePackageFiles(packageConfig) {
        const path = packageConfig.manifestPath;
        const manifest = await getGithubFile(`${user}/${repo}/${path}`, {
            client,
            branch: packageConfig.headBranch || packageConfig.baseBranch,
        });
        return Object.assign({}, packageConfig, {
            manifest: parseJson(manifest.toString('utf-8')),
            // TODO: parse npm config
            // TODO: parse yarn config
        });
    }

    async function getPackageUpdates(packageConfigPromise) {
        const packageConfig = await packageConfigPromise;
        const updates = await getUpdates(packageConfig.manifest);
        return Object.assign({}, packageConfig, {
            updates,
        });
    }

    async function createPRBranches(packageConfigPromise) {
        const packageConfig = await packageConfigPromise;
        if (!packageConfig.prExists && packageConfig.updates.length) {
            const headBranch = getBranchName(packageConfig.path);
            const { sha: branchHead } = await client.repos.getShaOfCommitRef({
                user,
                repo,
                ref: packageConfig.baseBranch,
            });
            await client.gitdata.createReference({
                user,
                repo,
                sha: branchHead,
                ref: `refs/heads/${headBranch}`,
            });
            return Object.assign({}, packageConfig, { headBranch });
        }
        return packageConfig;
    }

    async function createUpdateCommits(packageConfigPromise) {
        const packageConfig = await packageConfigPromise;
        for (let update of packageConfig.updates) {
            const newManifest = Object.assign({}, packageConfig.manifest);
            newManifest[update.type][update.name] = update.latest;

            const dir = dirname(packageConfig.manifestPath);
            const { tree } = await client.gitdata.getTree({
                user,
                repo,
                sha: `${packageConfig.headBranch}:${dir}`,
            });
            const item = tree.find(matchManifest);

            await client.repos.updateFile({
                user,
                repo,
                path: packageConfig.manifestPath,
                message: `chore: update "${update.name}" in "${update.type}"`,
                content: new Buffer(
                    JSON.stringify(newManifest, null, 2),
                ).toString('base64'),
                sha: item.sha,
                branch: packageConfig.headBranch,
            });

            if (packageConfig.lockFiles.length) {
                // TODO: update lock files
            }
        }
        return packageConfig;
    }

    async function createPullRequest(packageConfigPromise) {
        const packageConfig = await packageConfigPromise;
        if (!packageConfig.prExists) {
            await client.pullRequests.create({
                user,
                repo,
                title: `Update dependencies for ${packageConfig.path}`,
                body: unindent(`
Bazinga!

This PR has been automatically created through the [dependency-updater](https://github.com/nerdlabs/dependency-updater).

It contains updates for all your \`dependencies\` and \`devDependencies\` in
the following package: \`${packageConfig.path}\`.
                `),
                head: packageConfig.headBranch,
                base: packageConfig.baseBranch,
            });
        }
        return packageConfig;
    }

    return await Promise.all(
        manifests
            .map(getPackageConfig)
            .map(setBranchConfig)
            .map(parsePackageFiles)
            .map(getPackageUpdates)
            .map(createPRBranches)
            .map(createUpdateCommits)
            .map(createPullRequest),
    );
}
