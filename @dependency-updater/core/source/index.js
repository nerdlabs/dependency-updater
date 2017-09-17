import unindent from 'unindent';
import getGithubFile from 'get-github-file';
import createGithubPullRequest from 'create-github-pull-request';

exports.handler = function (event, context, callback) {
  updateDependencies()
    .then((result) => callback(null, result))
    .catch(callback);
};

async function updateDependencies() {
  const auth = {
    type: 'basic',
    username: '',
    password: ''
  };

  const uri = `nerdlabs/react-amp-layout/package.json`;
  const content = await getGithubFile(uri, { auth });
  const manifest = JSON.parse(content.toString('utf-8'));

  await Promise.all(['dependencies', 'devDependencies'].map(async (type) => {
    const dependencies = Object.keys(manifest[type] || {});
    const latestVersions = await getLatestVersions(dependencies);

    return Promise.all(latestVersions.map((updatedDepedency) => {
      const newManifest = updateManifest(manifest, type, updatedDepedency);

      const message = unindent(`
        Update ${updatedDepedency.name} to ${updatedDepedency.latest}
      `);

      return createGithubPullRequest(
        uri,
        new Buffer(newManifest),
        {
          auth,
          message,
          prBranch: `update-${updatedDepedency.name}-${updatedDepedency.latest}`
        }
      );
    }));
  }));
}

function updateManifest(manifest, type, { name, latest }) {
  return JSON.stringify({
    ...manifest,
    [type]: {
      ...manifest[type],
      [name]: latest,
    },
  }, null, 2);
}

// TODO: extract into its own file
import semver from 'semver';
import latestVersion from 'latest-version';

async function getLatestVersions(dependencies) {
  const latestVersions = await Promise.all(
    dependencies.map(async (name) => ({
      name,
      latest: await latestVersion(name)
    }))
  );

  return latestVersions.filter(({ name, latest }) => {
    const current = depedencies[name];
    const isCoveredByRange = semver.satisfies(latest, current);

    return !isCoveredByRange && semver.gt(latest, current);
  });
}
