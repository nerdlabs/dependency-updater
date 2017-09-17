import { basename } from 'path';

export default async function getManifests(client, user, repo) {
	const { tree } = await client.gitdata.getTree({
		user,
		repo,
		sha: 'HEAD',
		recursive: true
	});

	return tree
		.filter(ignoreNodeModules)
		.filter(matchManifest);
}

function ignoreNodeModules(item) {
	return !item.path.includes('node_modules');
}

function matchManifest(item) {
	return basename(item.path) === 'package.json' && item.type === 'blob';
}
