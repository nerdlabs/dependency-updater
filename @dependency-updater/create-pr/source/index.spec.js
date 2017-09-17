import { AssertionError } from 'assert';
import test from 'ava';
import sinon from 'sinon';
import sinonStubPromise from 'sinon-stub-promise';
import Github from 'github';
import createGithubPullRequest from './';

sinonStubPromise(sinon);

const uri = 'owner/repo/package.json';
const content = new Buffer('content');

test.beforeEach(t => {
    const github = new Github();

    github.authenticate = sinon.stub(github, 'authenticate');
    github.repos.get = sinon
        .stub(github.repos, 'get')
        .returnsPromise()
        .resolves({ default_branch: 'master' });
    github.repos.getShaOfCommitRef = sinon
        .stub(github.repos, 'getShaOfCommitRef')
        .returnsPromise()
        .resolves({ sha: 'abcd1234' });
    github.gitdata.createReference = sinon
        .stub(github.gitdata, 'createReference')
        .returnsPromise()
        .resolves({});
    github.gitdata.getTree = sinon
        .stub(github.gitdata, 'getTree')
        .returnsPromise()
        .resolves({
            tree: [
                { path: '.babelrc', sha: '1234abcd' },
                { path: 'package.json', sha: 'abcd0987' },
            ],
        });
    github.repos.updateFile = sinon
        .stub(github.repos, 'updateFile')
        .returnsPromise()
        .resolves({});

    github.pullRequests.create = sinon
        .stub(github.pullRequests, 'create')
        .returnsPromise()
        .resolves({});

    t.context.github = github;
});

test.afterEach(t => {
    t.context.github.authenticate.restore();
    t.context.github.repos.get.restore();
    t.context.github.repos.getShaOfCommitRef.restore();
    t.context.github.gitdata.createReference.restore();
    t.context.github.gitdata.getTree.restore();
    t.context.github.repos.updateFile.restore();
    t.context.github.pullRequests.create.restore();
});

test('when called with invalid parameters', t => {
    t.throws(
        createGithubPullRequest(),
        AssertionError,
        'does not allow empty parameters',
    );

    t.throws(
        createGithubPullRequest({}),
        AssertionError,
        'does not allow object as first parameter',
    );

    t.throws(
        createGithubPullRequest('owner/repo/x', 'content'),
        AssertionError,
        'does not allow string as content parameter',
    );

    t.throws(
        createGithubPullRequest('owner/repo', new Buffer('x')),
        AssertionError,
        'it throws if there is no file path in the uri',
    );
});

test('github authentication', async t => {
    const client = t.context.github;
    {
        await createGithubPullRequest(uri, content, { client });
        const actual = t.context.github.authenticate.callCount;
        const expected = 0;

        t.is(
            actual,
            expected,
            'without `auth` in options should not authenticate against github',
        );
    }
    {
        const auth = { type: 'basic' };

        await createGithubPullRequest(uri, content, { client, auth });
        const actual = t.context.github.authenticate.firstCall.args[0];
        const expected = auth;

        t.is(
            actual,
            expected,
            'passing `auth` in options should authenticate against github',
        );
    }
});

test('branch creation', async t => {
    const client = t.context.github;

    await createGithubPullRequest(uri, content, { client });
    {
        const actual = client.gitdata.createReference.firstCall.args[0].sha;
        const expected = 'abcd1234';

        t.is(actual, expected, 'should branch off of HEAD of branch');
    }
    {
        const actual = client.gitdata.createReference.firstCall.args[0].ref;
        const expected = 'refs/heads/update-package.json-040f06';

        t.is(
            actual,
            expected,
            'should create a new branch with specified naming scheme',
        );
    }
});

test('committing the updated file', async t => {
    const client = t.context.github;

    await createGithubPullRequest(uri, content, { client });
    {
        const actual = client.repos.updateFile.firstCall.args[0].path;
        const expected = 'package.json';

        t.is(
            actual,
            expected,
            'should specify the path to the file being updated',
        );
    }
    {
        const actual = client.repos.updateFile.firstCall.args[0].message;
        const expected = 'update package.json';

        t.is(actual, expected, 'should create a generic commit message');
    }
    {
        const actual = client.repos.updateFile.firstCall.args[0].content;
        const expected = content.toString('base64');

        t.is(actual, expected, 'should send file content as base64 encoded');
    }
    {
        const actual = client.repos.updateFile.firstCall.args[0].sha;
        const expected = 'abcd0987';

        t.is(actual, expected, 'should specify sha of file as parent sha');
    }
    {
        const actual = client.repos.updateFile.firstCall.args[0].branch;
        const expected = 'update-package.json-040f06';

        t.is(
            actual,
            expected,
            'should create commit on previously created branch',
        );
    }
});

test('creating a pull request', async t => {
    const client = t.context.github;

    await createGithubPullRequest(uri, content, { client });
    {
        const actual = client.pullRequests.create.firstCall.args[0].title;
        const expected = 'update package.json';

        t.is(
            actual,
            expected,
            'should use commit message if no message has been specified',
        );
    }
    {
        const actual = client.pullRequests.create.firstCall.args[0].head;
        const expected = 'update-package.json-040f06';

        t.is(
            actual,
            expected,
            'should point the HEAD to the newly created branch',
        );
    }
    {
        const actual = client.pullRequests.create.firstCall.args[0].base;
        const expected = 'master';

        t.is(actual, expected, 'should point the base to the default_branch');
    }
});

test('updating a file in a sub-directory', async t => {
    const client = t.context.github;
    const subUri = 'owner/repo/path/to/package.json';
    client.gitdata.getTree.restore();
    client.gitdata.getTree = sinon
        .stub(client.gitdata, 'getTree')
        .returnsPromise()
        .resolves({
            tree: [
                { path: 'nope', sha: 'aceg1357' },
                { path: 'package.json', sha: '8765efgh' },
                { path: 'foo', sha: 'efgh5678' },
            ],
        });

    await createGithubPullRequest(subUri, content, { client });

    {
        const actual = client.gitdata.getTree.firstCall.args[0].sha;
        const expected = 'master:path/to';

        t.is(
            actual,
            expected,
            'should get the tree for the parent path of file',
        );
    }
    {
        const actual = client.gitdata.createReference.firstCall.args[0].ref;
        const expected = 'refs/heads/update-path/to/package.json-040f06';

        t.is(actual, expected, 'should create a new branch');
    }
    {
        const actual = client.repos.updateFile.firstCall.args[0].sha;
        const expected = '8765efgh';

        t.is(actual, expected, 'should specify sha of file as parent sha');
    }
});

test('overriding `options.baseBranch`', async t => {
    const client = t.context.github;

    await createGithubPullRequest(uri, content, {
        client,
        baseBranch: 'new_base',
    });

    {
        const actual = client.repos.getShaOfCommitRef.firstCall.args[0].ref;
        const expected = 'new_base';

        t.is(
            actual,
            expected,
            'should get the HEAD of the specified baseBranch',
        );
    }
    {
        const actual = client.pullRequests.create.firstCall.args[0].base;
        const expected = 'new_base';

        t.is(
            actual,
            expected,
            'should point the base to the specified baseBranch',
        );
    }
});

test('overriding `options.prBranch`', async t => {
    const client = t.context.github;

    await createGithubPullRequest(uri, content, { client, prBranch: 'tmp' });

    {
        const actual = client.gitdata.createReference.firstCall.args[0].ref;
        const expected = 'refs/heads/tmp';

        t.is(actual, expected, 'should name the PR branch correctly');
    }
    {
        const actual = client.repos.updateFile.firstCall.args[0].branch;
        const expected = 'tmp';

        t.is(actual, expected, 'should create commit in PR branch');
    }
    {
        const actual = client.pullRequests.create.firstCall.args[0].head;
        const expected = 'tmp';

        t.is(actual, expected, 'should specify PR branch in PR');
    }
});

test('overriding `options.message`', async t => {
    const client = t.context.github;
    const message =
        'this is the title\n\nthis is the body\n\nthis is the footer';

    await createGithubPullRequest(uri, content, { client, message });

    {
        const actual = client.repos.updateFile.firstCall.args[0].message;
        const expected = message;

        t.is(actual, expected, 'should set the correct commit message');
    }
    {
        const actual = client.pullRequests.create.firstCall.args[0].title;
        const expected = 'this is the title';

        t.is(actual, expected, 'should set the first line as PR title');
    }
    {
        const actual = client.pullRequests.create.firstCall.args[0].body;
        const expected = 'this is the body\n\nthis is the footer';

        t.is(actual, expected, 'should set the other lines as body');
    }
});
