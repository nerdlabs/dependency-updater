import test from 'ava';
import getManifests from './get-manifests';


test.beforeEach(t => {
	const github = {
		gitdata: {
			getTree: async (options) => {
				return {
					tree: [{
						path: 'does_not_match',
						type: 'blob'
					}, {
						path: 'node_modules/does_not_match',
						type: 'blob'
					}, {
						path: 'node_modules/x/package.json',
						type: 'blob'
					}, {
						path: 'package.json',
						type: 'blob'
					}, {
						path: 'foo/node_modules/package.json',
						type: 'blob'
					}, {
						path: 'foo/package.json',
						type: 'blob'
					}, {
						path: 'package.json',
						type: 'tree'
					}, {
						path: 'package.json',
						type: 'commit'
					}],
				};
			}
		}
	};
	t.context.github = github;
});

test('it ignores node_modules', async (t) => {
	const actual = await getManifests(t.context.github, 'user', 'repo');
	t.false(actual.some(item => item.path.includes('node_modules')));
});

test('it contains all package.json files', async (t) => {
	const actual = await getManifests(t.context.github, 'user', 'repo');
	t.deepEqual(actual, [{
		path: 'package.json',
		type: 'blob'
	}, {
		path: 'foo/package.json',
		type: 'blob'
	}]);
});
