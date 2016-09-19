import GitHub from 'github';

exports.handler = function(event, context, callback) {
  updateDependencies()
    .then((result) => callback(null, result))
    .catch(callback);
};

async function updateDependencies() {
  const github = new GitHub();

  github.authenticate({
    type: "basic",
    username: '<user with write access to repository>',
    password: '<password>'
  });

  const repoConfig = {
    user: 'nerdlabs',
    repo: 'react-amp-layout',
  };

  const filePath = 'package.json';

  const {default_branch} = await github.repos.get(repoConfig);

  const {sha: latestCommitSha} = await github.repos.getShaOfCommitRef({
    ...repoConfig,
    ref: default_branch,
  });

  const {encoding, content, sha: parentSha} = await github.repos.getContent({
    ...repoConfig,
    path: filePath,
    ref: default_branch,
  });

  const fileContent = new Buffer(content, encoding).toString('utf-8');
  const manifest = JSON.parse(fileContent);

  const updatedDependencies = await getUpdatedDependencies(
    manifest,
    'dependencies'
  );

  const updatedDevDependencies = await getUpdatedDependencies(
    manifest,
    'devDependencies'
  );

  function updateManifest(manifest, type, {name, latest}) {
    return {
      ...manifest,
      [type]: {
        ...manifest[type],
        [name]: latest,
      },
    };
  }

  async function updateDepedency(manifest, name, version, base, head, parent) {
    await github.gitdata.createReference({
      ...repoConfig,
      sha: head,
      ref: `refs/heads/update-${name}-${version}`,
    });

    await github.repos.updateFile({
      ...repoConfig,
      path: filePath,
      message: `update ${name} to version ${version}`,
      content: new Buffer(JSON.stringify(manifest, null, 2)).toString('base64'),
      sha: parent,
      branch: `update-${name}-${version}`,
    });

    await github.pullRequests.create({
      ...repoConfig,
      title: `update ${name} to version ${version}`,
      head: `update-${name}-${version}`,
      base: base,
    });
  }

  const newManifest = updateManifest(
    manifest,
    'devDependencies',
    updatedDevDependencies[0]
  );

  await updateDepedency(
    newManifest,
    updatedDevDependencies[0].name,
    updatedDevDependencies[0].latest,
    default_branch,
    latestCommitSha,
    parentSha
  );

  return [...updatedDependencies, ...updatedDevDependencies];
}

// TODO: extract into its own file
import semver from 'semver';
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

async function getUpdatedDependencies(manifest, type) {
  const depedencies = manifest[type] || {};

  const packages = await Promise.all(Object.keys(depedencies).map(getPackage));

  const latestVersions = packages.map((manifest) => ({
    name: manifest.name,
    latest: manifest['dist-tags'].latest,
  }));

  return latestVersions.filter(({name, latest}) => {
    const current = depedencies[name];
    const isCoveredByRange = semver.satisfies(latest, current);

    return !isCoveredByRange && semver.gt(latest, current);
  });
}
