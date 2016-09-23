// @flow
import assert from 'assert';
import Github from 'github';
import type {Uri, Options} from './index';

export default async function getGithubFile(uri: Uri, options: Options = {}) {
	assert(typeof uri === 'string', 'The uri parameter must be a string.');

	const {client = new Github(), auth} = options;
	const [user, repo, ...pathParts] = uri.split('/');
	assert(pathParts.length > 0, 'The uri must contain a file path');

	const path = pathParts.join('/');

	if (auth) {
		client.authenticate(auth);
	}

	const {default_branch: defaultBranch} = await client.repos.get({user, repo});
	const {branch = defaultBranch} = options;

	const {content, encoding} = await client.repos.getContent({
		user,
		repo,
		path,
		ref: branch
	});

	return new Buffer(content, encoding);
}
