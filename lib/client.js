var
  _ = require('lodash'),
  async = require('async'),
  GitHubApi = require('github');

var
  VERSION_PATTERN = /^v\d+/,
  CONCURRENCY_LIMIT = 5;

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
      host: options.host ? options.host : 'api.github.com',
      pathPrefix: options.prefix ? options.prefix : null,
      timeout: 5000
    });

  client.authenticate({
    type: 'oauth',
    token: options.token
  });

  function fetchAll(method, fetchOptions, done) {
    var
      allResults = [],
      lastResults,
      defaultOptions = { page: 0, per_page: 100 },
      options = _.merge({}, repoOptions, defaultOptions, fetchOptions);

    async.doUntil(function _fetchAllFunction(cb) {
      options.page++;

      method(options, function _fetchReturned(err, results) {
        if (err) return cb(err);

        allResults = allResults.concat(results);
        lastResults = results.length;
        cb(null);
      });
    },
    function _fetchAllTest() {
      return lastResults <= options.per_page;
    },
    function _fetchAllTFinished(err) {
      done(err, allResults);
    });
  }

  function filterTags(tags, pattern) {
    return _.filter(tags, function (tag) {
      return tag.name.match(pattern);
    });
  }

  function mapTags(tags, cb) {
    var versionTags = filterTags(tags, VERSION_PATTERN);

    async.mapLimit(versionTags, CONCURRENCY_LIMIT, mapTag, cb);
  }

  function mapTag(tag, cb) {
    fetchCommit(tag.commit.sha, function commitFetched(err, commit) {
      if (err) return cb(err);

      var commitDate = Date.parse(commit.commit.committer.date);
      cb(null, { name: tag.name, toDate: commitDate });
    });
  }

  function fetchCommit(sha, cb) {
    client.repos.getCommit(_.merge({}, repoOptions, { sha: sha }), cb);
  }

  function fetchTags(cb) {
    fetchAll(client.repos.getTags, {}, cb);
  }

  function setStartDatesToTags(tags, cb) {
    var sortedTags = _.sortBy(tags, 'toDate');

    _.reduce(sortedTags, function (previous, tag) {
      tag.fromDate = previous;
      return tag.toDate;
    }, 0);

    cb(null, sortedTags);
  }

  function fetchPullRequests(cb) {
    fetchAll(client.pullRequests.getAll, { state: 'closed' }, cb);
  }

  return {
    collect: function collect(cb) {
      async.parallel({
        tags: async.seq(fetchTags, mapTags, setStartDatesToTags),
        pullRequests: fetchPullRequests
      }, cb);
    }
  };
}

