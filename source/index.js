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

  return JSON.parse(fileContent);
}
