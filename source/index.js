import GitHub from 'github';

exports.handler = function(event, context, callback) {
  updateDependencies()
    .then((result) => callback(null, result))
    .catch(callback);
};

async function updateDependencies() {
  const github = new GitHub();

  // XXX: this is static at the moment, later it will of course be configurable
  // TODO: do we want to check multiple file paths (mono-repo)?
  // TODO: do we want to check multiple repositories per invocation?
  const result = await github.repos.getContent({
    user: 'nerdlabs',
    repo: 'react-amp-layout',
    path: 'package.json'
  });

  const {encoding = 'base64', content} = result;
  const fileContent = new Buffer(content, encoding).toString('utf-8');
  const data = JSON.parse(fileContent);
  const updatedDependencies = await getUpdatedDependencies(data);

  // for every updated dependency:
  // - check whether a PR for this update already exists: https://mikedeboer.github.io/node-github/#api-pullRequests-getAll
  // - update version number in package.json
  // - create a new branch: https://mikedeboer.github.io/node-github/#api-gitdata-createReference
  // - update the package.json file in the newly created branch: https://mikedeboer.github.io/node-github/#api-repos-updateFile
  // - create a new pull request: https://mikedeboer.github.io/node-github/#api-pullRequests-create

  return updatedDependencies;
}

// TODO: extract into its own file
import RegistryClient from 'npm-registry-client';

const noop = () => {};

const config = {
  log: {
    error: noop,
    warn: noop,
    info: noop,
    verbose: noop,
    silly: noop,
    http: noop,
    pause: noop,
    resume: noop
  }
};

const client = new RegistryClient(config);

function getPackage(name) {
  return new Promise((resolve, reject) => {
    const uri = `https://registry.npmjs.org/${name}`;

    client.get(uri, {}, (error, data) => error ? reject(error) : resolve(data));
  });
}

// TODO: extract into its own file
import semver from 'semver';

async function getUpdatedDependencies(manifest) {
  // XXX: are there any other *Dependencies that we should include?
  const {dependencies = {}, devDependencies = {}} = manifest;
  const allDependencies = {...dependencies, ...devDependencies};

  const packages = await Promise.all(
    Object.keys(allDependencies).map(getPackage)
  );

  const latestVersions = packages.map((manifest) => ({
    name: manifest.name,
    // XXX: should we also check for other dist-tags?
    latest: manifest['dist-tags'].latest
  }));

  return latestVersions.filter(({name, latest}) => {
    const current = allDependencies[name];
    // XXX: maybe also verify that this update would not already be covered by the
    // current semver range to reduce the amount of unneccessary PRs
    return semver.gt(latest, current);
  });
}
