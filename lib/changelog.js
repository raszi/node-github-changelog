var
  _ = require('lodash'),
  async = require('async'),
  Client = require('./client').Client,
  Parser = require('./parser'),
  util = require('util'),
  Writer = require('conventional-changelog/lib/writer');

var DATE_PATTERN = /( \(\d{4}-\d{2}-\d{2}\)) \(\d{4}-\d{2}-\d{2}\)/g;

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

  function formatDate(timestamp) {
    return new Date(timestamp).toJSON().split('T')[0];
  }

  function writeLog(tag, cb) {
    var
      repository = util.format('%s://%s/%s/%s',
        (options.secure) ? 'https' : 'http',
        options.base || options.host,
        options.user, options.repo
      ),
      releaseURL = util.format('%s/releases/tag/%s', repository, tag.version);

    function versionText(version) {
      return util.format('## [%s](%s) (%s)', version, releaseURL, formatDate(tag.toDate));
    }

    function patchVersionText(version) {
      return '#' + versionText(version);
    }

    var writerOptions = {
      subtitle: '',
      version: tag.version,
      repository: repository,
      versionText: versionText,
      patchVersionText: patchVersionText
    };

    Writer.writeLog(tag.logs, writerOptions, removeDates(cb));
  }

  function removeDates(cb) {
    return function (err, result) {
      if (err) return cb(err);
      cb(null, result.replace(DATE_PATTERN, '$1'));
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
