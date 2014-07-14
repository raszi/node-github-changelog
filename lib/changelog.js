var
  _ = require('lodash'),
  async = require('async'),
  Client = require('./client').Client,
  Parser = require('./parser'),
  util = require('util'),
  Writer = require('conventional-changelog/lib/writer');

var
  ISSUE_PATTERN = /\(#(\d+)\)/g,
  SHA_PATTERN = /\(([a-f0-9]{8})\)/g,
  DATE_PATTERN = / \(\d{4}-\d{2}-\d{2}\)/g;

exports.Changelog = function ChangeLog(passedOptions) {
  var options = _.extend({}, passedOptions);
  if (_.isUndefined(options.host)) options.host = 'api.github.com';

  function createTag(version, toDate) {
    return {
      version: version,
      toDate: toDate,
      pullRequests: []
    };
  }

  function mapTag(tag) {
    var commitDate = Date.parse(tag.commit.commit.committer.date);
    return createTag(tag.name, commitDate);
  }

  function mapTags(tags) {
    var sortedTags = _.chain(tags)
      .sortBy('toDate')
      .map(mapTag)
      .value();

    sortedTags.push(createTag('upcoming', _.now()));

    _.reduce(sortedTags, function (previous, tag) {
      tag.fromDate = previous;
      return tag.toDate;
    }, 0);

    return sortedTags;
  }

  function mergePullRequests(tags, pullRequests) {
    _.forEach(pullRequests, function (pullRequest) {
      var mergeDate = Date.parse(pullRequest.merged_at);

      var tag = _.find(tags, function (tag) {
        return tag.fromDate <= mergeDate && mergeDate <= tag.toDate;
      });

      if (tag) {
        tag.pullRequests.push(pullRequest);
      }
    });

    _.forEach(tags, function (tag) {
      tag.logs = Parser.mapToLog(tag.pullRequests);
    });
  }

  function fetchTagsWithLogs(cb) {
    var client = new Client(options);

    client.collect(function collected(err, results) {
      if (err) return cb(err);

      var
        tags = mapTags(results.tags),
        pullRequests = Parser.filter(results.pullRequests);

      mergePullRequests(tags, pullRequests);

      cb(null, tags);
    });
  }

  function writeLog(tag, cb) {
    var writerOptions = {
      subtitle: '',
      version: tag.version
    };

    Writer.writeLog(tag.logs, writerOptions, setLinks(cb));
  }

  function setLinks(cb) {
    var base = util.format('%s://%s/%s/%s',
      (options.secure) ? 'https' : 'http',
      options.base || options.host,
      options.user, options.repo
    );

    return function (err, result) {
      if (err) return cb(err);

      result = result.replace(ISSUE_PATTERN, function (match, prNum) {
        return util.format('([#%d](%s/issues/%d))', prNum, base, prNum);
      });

      result = result.replace(SHA_PATTERN, function (match, sha1) {
        return util.format('([%s](%s/commit/%s))', sha1, base, sha1);
      });

      result = result.replace(DATE_PATTERN, '');

      cb(null, result);
    };
  }

  function formatChangelog(tags, cb) {
    var sortedTags = _.sortBy(tags, 'toDate').reverse();

    async.map(sortedTags, writeLog, function (err, result) {
      if (err) return cb(err);
      cb(null, result.join("\n\n"));
    });
  }

  return {
    create: async.seq(fetchTagsWithLogs, formatChangelog)
  };
};
