var
  _ = require('lodash'),
  async = require('async'),
  cp = require('child_process'),
  util = require('util');

exports.Git = Git;

var COMMIT_FORMAT = '|%H|%ct000|%s';

function Git(options) {
  function parseCommit(line) {
    var items = line.split('|', 4);

    return {
      sha: items[1],
      date: parseInt(items[2]),
      message: items[3]
    };
  }

  function exec(command, cb) {
    var execOptions = {
      cwd: options.localRepo,
      maxBuffer: 10 * 1024 * 1024
    };

    cp.exec(command, execOptions, function (err, stdout, stderr) {
      if (err) { return cb(err); }
      if (stderr) { return cb(stderr); }

      cb(null, String(stdout).trim());
    });
  }

  function getInitialCommit(cb) {
    exec('git rev-list --max-parents=0 HEAD', cb);
  }

  function getTags(cb) {
    exec('git show-ref --tags', function getTags(err, results) {
      if (err) { return cb(err); }

      var tags = _.map(results.split('\n'), function (tagLine) {
        var tag = tagLine.split(' refs/tags/');
        return { name: tag[1], sha: tag[0] };
      });

      async.map(tags, function (tag, cb) {
        getCommit(tag.sha, function (err, commit) {
          if (err) { return cb(err); }

          cb(null, _.extend(tag, commit));
        });
      }, cb);
    });
  }

  function getCommit(sha, cb) {
    exec(util.format('git show -s --format="%s" %s', COMMIT_FORMAT, sha), function commitFetched(err, results) {
      if (err) { return cb(err); }

      var
        lines =results.split('\n'),
        line = _.find(lines, function (line) { return line.match(/^\|/); }),
        commit = parseCommit(line);

      return cb(null, commit);
    });
  }

  function getCommits(ref, cb) {
    exec(util.format('git log --format="%s" %s', COMMIT_FORMAT, ref), function commitsFetched(err, results) {
      if (err) { return cb(err); }

      var commits = _.map(_.compact(results.split('\n')), parseCommit);
      cb(err, commits);
    });
  }

  return {
    getInitialCommit: getInitialCommit,
    getTags: getTags,
    getCommits: getCommits
  };
}
