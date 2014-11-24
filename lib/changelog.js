var
  _ = require('lodash'),
  async = require('async'),
  Client = require('./client').Client,
  Tag = require('./tag'),
  Git = require('./git').Git,
  Parser = require('./parser'),
  util = require('util'),
  Writer = require('conventional-changelog/lib/writer');

var
  DATE_PATTERN = /( \(\d{4}-\d{2}-\d{2}\)) \(\d{4}-\d{2}-\d{2}\)/g,
  PULL_REQUEST_PATTERN = /^Merge pull request #(\d+)/;

exports.Changelog = function ChangeLog(passedOptions) {
  var options = _.extend({}, passedOptions);
  if (_.isUndefined(options.host)) { options.host = 'api.github.com'; }

  function mapTags(localTags, initialCommit) {
    var sortedTags = _.chain(localTags)
      .map(Tag.fromLocalTag)
      .sortBy('date')
      .value();

    sortedTags.push(Tag.custom('upcoming', _.now(), 'HEAD'));

    _.reduce(sortedTags, function (previous, tag) {
      tag.setFromCommit(previous);
      return tag.toCommit;
    }, initialCommit);

    return sortedTags;
  }

  function filterPullRequestIds(commits) {
    return _.compact(_.map(commits, function (commit) {
      var matches = commit.message.match(PULL_REQUEST_PATTERN);
      return matches ? _.parseInt(matches[1], 10) : null;
    }));
  }

  function addFilteredLogsToTags(pullRequestForTags, tags) {
    _.forEach(pullRequestForTags, function (pullRequests, i) {
      var tag = tags[i];
      tag.addLogs(Parser.filerAndMapToLog(pullRequests));
    });
  }

  function fetchTagsWithLogs(cb) {
    var git = new Git(options);

    async.parallel({ tags: git.getTags, initialCommit: git.getInitialCommit }, function (err, results) {
      if (err) { return cb(err); }

      var tags = mapTags(results.tags, results.initialCommit);

      if (options.last) {
        tags = tags.slice(-2);
      }

      if (options.skipUpcoming) {
        tags = tags.slice(0, tags.length - 1);
      }

      var commitFilters = _.invoke(tags, 'commitFilters');

      async.map(commitFilters, git.getCommits, function (err, commits) {
        if (err) { return cb(err); }

        var client = new Client(options);
        var pullRequestTasks = _.map(commits, _.compose(client.fetchPullRequests, filterPullRequestIds));

        async.series(pullRequestTasks, function (err, pullRequestForTags) {
          if (err) { return cb(err); }

          addFilteredLogsToTags(pullRequestForTags, tags);
          cb(null, tags);
        });
      });
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
      return util.format('## [%s](%s) (%s)', version, releaseURL, formatDate(tag.date));
    }

    function patchVersionText(version) {
      return util.format('#%s', versionText(version));
    }

    var writerOptions = {
      subtitle: '',
      version: tag.version,
      repository: repository,
      versionText: versionText,
      includeChores: true,
      patchVersionText: patchVersionText
    };

    Writer.writeLog(tag.logs, writerOptions, removeDates(cb));
  }

  function removeDates(cb) {
    return function (err, result) {
      if (err) { return cb(err); }
      cb(null, result.replace(DATE_PATTERN, '$1'));
    };
  }

  function formatChangelog(tags, cb) {
    var sortedTags = _.sortBy(tags, 'toDate').reverse();

    async.map(sortedTags, writeLog, function (err, result) {
      if (err) { return cb(err); }
      cb(null, result.join("\n\n"));
    });
  }

  return {
    create: async.seq(fetchTagsWithLogs, formatChangelog)
  };
};
