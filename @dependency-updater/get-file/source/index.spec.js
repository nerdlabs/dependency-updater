import { AssertionError } from 'assert';
import test from 'ava';
import sinon from 'sinon';
import sinonStubPromise from 'sinon-stub-promise';
import Github from 'github';
import getGithubFile from './';

sinonStubPromise(sinon);

test.beforeEach(t => {
    const github = new Github();
    t.context.github = github;

    t.context.github.authenticate = sinon.spy(github, 'authenticate');

    t.context.github.repos.get = sinon
        .stub(github.repos, 'get')
        .returnsPromise()
        .resolves({
            default_branch: 'master', // eslint-disable-line camelcase
        });

    t.context.github.repos.getContent = sinon
        .stub(github.repos, 'getContent')
        .returnsPromise()
        .resolves({
            encoding: 'base64',
            content: new Buffer('content'),
        });
});

test.afterEach(t => {
    t.context.github.authenticate.restore();
    t.context.github.repos.get.restore();
    t.context.github.repos.getContent.restore();
});

test('when called with invalid parameters', t => {
    t.throws(
        getGithubFile(),
        AssertionError,
        'does not allow empty parameters',
    );

    t.throws(
        getGithubFile({}),
        AssertionError,
        'does not allow object as first parameter',
    );
});

test('when passing in a url to github repo', async t => {
    const { github } = t.context;

    await getGithubFile('user/repo/file.txt', { client: github });

    {
        const actual = github.repos.get.firstCall.args[0];
        const expected = { user: 'user', repo: 'repo' };

        t.deepEqual(
            actual,
            expected,
            'it should parse user and repo from the uri',
        );
    }
    {
        const actual = github.repos.getContent.firstCall.args[0].path;
        const expected = 'file.txt';

        t.is(actual, expected, 'it should parse the file name from the uri');
    }
});

test('when not specifying a branch via options', async t => {
    const { github } = t.context;

    await getGithubFile('user/repo/file.txt', { client: github });

    const actual = github.repos.getContent.firstCall.args[0].ref;
    const expected = 'master';

    t.is(actual, expected, 'it should find the default_branch (master)');
});

test('when providing a branch via options', async t => {
    const { github } = t.context;

    await getGithubFile('user/repo/file.txt', { client: github, branch: 'x' });

    const actual = github.repos.getContent.firstCall.args[0].ref;
    const expected = 'x';

    t.is(actual, expected, 'it should use the specified branch instead');
});

test('when passing in basic auth via options', async t => {
    const { github } = t.context;

    const basicAuthFixture = {
        type: 'basic',
        username: 'login username',
        password: 'login password',
    };

    await getGithubFile('user/repo/file.txt', {
        client: github,
        auth: basicAuthFixture,
    });

    const actual = github.authenticate.firstCall.args[0];
    const expected = basicAuthFixture;

    t.is(actual, expected, 'it should pass auth to github.authenticate');
});

test('when fetching a file from an unauthenticated repository', async t => {
    const { github } = t.context;

    const actual = await getGithubFile('user/repo/file.txt', {
        client: github,
    });
    const expected = new Buffer('content');

    t.true(actual.equals(expected));
});
