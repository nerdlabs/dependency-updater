import unindent from 'unindent';
import getGithubFile from '@dependency-updater/get-file';
import createGithubPullRequest from '@dependency-updater/create-pr';
import semver from 'semver';
import latestVersion from 'latest-version';
import Github from 'github';
import parseJson from 'parse-json';
import getManifests from './get-manifests';

exports.handler = function (event, context, callback) {
	main({
		auth: {
			type: 'basic',
			username: process.env.GITHUB_USER_NAME,
			password: process.env.GITHUB_PASSWORD,
		},
		user: process.env.GITHUB_REPO_OWNER,
		repo: process.env.GITHUB_REPO_NAME,
	})
		.then((result) => callback(null, result))
		.catch(callback);
};


async function main({ auth, user, repo }) {
	const client = new Github();
	client.authenticate(auth);
	const manifests = await Promise.all(
		(await getManifests(client, user, repo))
			.map(({ path }) => {
				const file = getGithubFile(`${user}/${repo}/${path}`, { client })
				return { path, file };
			})
			.map(async ({ path, file }) => {
				const content = parseJson((await file).toString('utf-8'))
				return { path, content };
			})

	);

	await Promise.all(manifests.map(async ({ path, content: manifest }) => {
		const updates = await getUpdates(manifest);
		if (!updates.dependencies.length && !updates.devDependencies.length) {
			return;
		}
		const newManifest = await updateDependencies(manifest, updates);
		const message = 'Update dependencies';
		console.log(newManifest);
		// return createGithubPullRequest(
		// 	`${user}/${repo}/${path}`,
		// 	new Buffer(newManifest),
		// 	{ client, message }
		// );
	}));
}

async function getUpdates(manifest) {
	const { dependencies = {}, devDependencies = {} } = manifest;
	const latestDependencies = await getLatestVersions(dependencies);
	const latestDevDependencies = await getLatestVersions(devDependencies);
	return {
		dependencies: latestDependencies,
		devDependencies: latestDevDependencies,
	};
}

async function updateDependencies(manifest, { dependencies, devDependencies }) {
	dependencies.forEach(({ name, latest }) => {
		manifest.dependencies[name] = latest;
	});
	devDependencies.forEach(({ name, latest }) => {
		manifest.devDependencies[name] = latest;
	});

	return JSON.stringify(manifest, null, 2);
}

async function getLatestVersions(dependencies) {
	return (await Promise.all(
		Object.keys(dependencies).map(async (name) => ({
			name,
			current: dependencies[name],
			latest: await latestVersion(name)
		}))
	))
		.filter(({ name, current, latest }) => {
			return Boolean(semver.validRange(current)) &&
				!semver.satisfies(latest, current);
		})
		.map(dependency => {
			if (dependency.current.startsWith('~')) {
				dependency.latest = `~${dependency.latest}`;
			}
			if (dependency.current.startsWith('^')) {
				dependency.latest = `^${dependency.latest}`;
			}
			return dependency;
		});
}
