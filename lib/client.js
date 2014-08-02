var
  _ = require('lodash'),
  async = require('async'),
  GitHubApi = require('github');

var
  NOT_FOUND_PATTERN = /"Not Found"/,
  CONCURRENCY_LIMIT = 10;

exports.Client = Client;

function Client(options) {
  var
    repoOptions = {
      user: options.user,
      repo: options.repo
    },
    client = new GitHubApi({
      debug: options.debug ? true : false,
      version: '3.0.0',
      rejectUnauthorized: options.sslCheck,
      protocol: options.secure ? 'https' : 'http',
      host: options.host,
      pathPrefix: options.prefix ? options.prefix : null,
      timeout: 5000
    });

  client.authenticate({
    type: 'oauth',
    token: options.token
  });

  function fetchPullRequest(number, cb) {
    client.pullRequests.get(_.merge({}, repoOptions, { number: number }), function pullRequestFetched(err, result) {
      if (err) {
        var message = err.message || '';
        return (options.ignore && message.match(NOT_FOUND_PATTERN)) ? cb(null) : cb(err);
      }

      cb(null, result);
    });
  }

  function fetchPullRequests(ids) {
    return function fetchPullRequests(cb) {
      async.mapLimit(ids, CONCURRENCY_LIMIT, fetchPullRequest, function (err, results) {
        if (err) { return cb(err); }
        cb(null, _.compact(results));
      });
    };
  }

  return {
    fetchPullRequests: fetchPullRequests
  };
}
