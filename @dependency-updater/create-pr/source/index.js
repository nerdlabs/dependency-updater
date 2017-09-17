import assert from 'assert';
import crypto from 'crypto';
import { basename, dirname } from 'path';
import Github from 'github';

export default async function createGithubPullRequest(
    uri,
    content,
    options = {},
) {
    assert(typeof uri === 'string', 'The uri parameter must be a string');
    assert(content instanceof Buffer, 'The content parameter must be a Buffer');

    const { client = new Github(), auth } = options;

    const [user, repo, ...pathParts] = uri.split('/');
    assert(pathParts.length > 0, 'The uri must contain a file path');
    const path = pathParts.join('/');

    if (auth) {
        client.authenticate(auth);
    }

    const { default_branch: defaultBranch } = await client.repos.get({
        user,
        repo,
    });
    const contentHash = crypto
        .createHash('sha1')
        .update(content)
        .digest('hex');
    const {
        baseBranch = defaultBranch,
        prBranch = `update-${path}-${contentHash.slice(0, 6)}`,
        message = `update ${path}`,
    } = options;

    const [title, ...bodyParts] = message.split('\n\n');
    const body = bodyParts.join('\n\n');

    const { tree } = await client.gitdata.getTree({
        user,
        repo,
        sha: `${baseBranch}${dirname(path) !== '.' ? `:${dirname(path)}` : ''}`,
    });

    const parentSha = tree.reduce((sha, object) => {
        if (sha !== null) {
            return sha;
        }
        return basename(path) === object.path ? object.sha : null;
    }, null);

    assert(typeof parentSha === 'string', `Could not find sha of ${path}`);

    const { sha: branchHead } = await client.repos.getShaOfCommitRef({
        user,
        repo,
        ref: baseBranch,
    });

    await client.gitdata.createReference({
        user,
        repo,
        sha: branchHead,
        ref: `refs/heads/${prBranch}`,
    });

    await client.repos.updateFile({
        user,
        repo,
        path,
        message,
        content: content.toString('base64'),
        sha: parentSha,
        branch: prBranch,
    });

    await client.pullRequests.create({
        user,
        repo,
        title,
        body,
        head: prBranch,
        base: baseBranch,
    });
}
