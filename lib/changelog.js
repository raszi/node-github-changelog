var
  _ = require('lodash'),
  async = require('async'),
  Client = require('./client').Client,
  Parser = require('./parser'),
  Writer = require('conventional-changelog/lib/writer');

var X_COMMIT_PATTERN = /^(\w*)(\(([\w\$\.\-\* ]*)\))?\: (.*)$/;

exports.Changelog = function ChangeLog(options) {
  function fetchTagsWithLogs(cb) {
    var client = new Client(options);

    client.collect(function collected(err, results) {
      if (err) return cb(err);

      var
        tags = results.tags,
        pullRequests = Parser.filter(results.pullRequests);

      _.forEach(pullRequests, function (pullRequest) {
        var mergeDate = Date.parse(pullRequest.merged_at);

        var tag = _.find(tags, function (tag) {
          return tag.fromDate <= mergeDate && mergeDate <= tag.toDate;
        });

        if (tag) {
          if (_.isUndefined(tag.pullRequests)) {
            tag.pullRequests = [];
          }

          tag.pullRequests.push(pullRequest);
        }
      });

      _.forEach(tags, function (tag) {
        tag.logs = Parser.mapToLog(tag.pullRequests);
      });

      cb(null, tags);
    });
  }

  function formatChangelog(tags, done) {
    async.map(tags, function (tag, cb) {
      var writerOptions = {
        subtitle: '',
        version: tag.name
      };

      Writer.writeLog(tag.logs, writerOptions, cb);
    }, function (err, result) {
      if (err) return done(err);
      done(null, result.join("\n\n"));
    });
  }

  return {
    create: async.seq(fetchTagsWithLogs, formatChangelog)
  };
};
