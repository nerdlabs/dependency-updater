exports.handler = function(event, context, callback) {
  console.log('event received!', event);

  if (event.shouldFail) {
    return callback(new Error('I am failing'));
  }

  callback(null, 'alles gut!');
};
