var
  _ = require('lodash'),
  GitReader = require('conventional-changelog/lib/git');

var COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|test|chore)\((.*?)\): (.*)$/;

function filter(pullRequestData) {
  return pullRequestData.title.match(COMMIT_PATTERN);
}

function mapToLog(pullRequestData) {
  function fixTitle(title) {
    return title.replace(COMMIT_PATTERN, function replaceTitle(match, type, scope, subject) {
      return type + '(' + scope.replace(/[^\w\$\.\-\* ]/, ' ') + '): ' + subject;
    });
  }

  var raw = [];

  raw.push(pullRequestData.merge_commit_sha);
  raw.push(fixTitle(pullRequestData.title));
  raw.push(pullRequestData.body);

  return GitReader.parseRawCommit(raw.join("\n"), {});
}

module.exports.filerAndMapToLog = function filterAndMap(pullRequests) {
  return _.map(_.filter(pullRequests, filter), mapToLog);
};
