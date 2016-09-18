import GitHub from 'github';

exports.handler = function(event, context, callback) {
  updateDependencies()
    .then((result) => callback(null, result))
    .catch(callback);
};

async function updateDependencies() {
  const github = new GitHub();

  const result = await github.repos.getContent({
    user: 'nerdlabs',
    repo: 'react-amp-layout',
    path: 'package.json'
  });

  const {encoding = 'base64', content} = result;
  const fileContent = new Buffer(content, encoding).toString('utf-8');
  const data = JSON.parse(fileContent);
  const updatedDependencies = await getUpdatedDependencies(data);
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
  const {dependencies = {}, devDependencies = {}} = manifest;
  const allDependencies = {...dependencies, ...devDependencies};

  const packages = await Promise.all(
    Object.keys(allDependencies).map(getPackage)
  );

  const latestVersions = packages.map((manifest) => ({
    name: manifest.name,
    latest: manifest['dist-tags'].latest
  }));

  return latestVersions.filter(({name, latest}) => {
    const current = allDependencies[name];
    return semver.gt(latest, current);
  });
}
