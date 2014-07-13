var
  _ = require('lodash'),
  GitReader = require('conventional-changelog/lib/git');

var
  COMMIT_PATTERN = /^(\w+)\((.*?)\): (.*)$/,
  TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'];

exports.filter = function filter(pullRequests) {
  function filterPullRequest(result) {
    var matches = result.title.match(COMMIT_PATTERN);
    return matches && TYPES.indexOf(matches[1]) !== -1;
  }

  return _.filter(pullRequests, filterPullRequest);
};

exports.mapToLog = function mapToLog(pullRequests) {
  function fixTitle(title) {
    return title.replace(COMMIT_PATTERN, function replaceTitle(match, type, scope, subject) {
      return type + '(' + scope.replace(/[^\w\$\.\-\* ]/, ' ') + '): ' + subject;
    });
  }

  function parsePullRequest(result) {
    var raw = [];

    raw.push(result.merge_commit_sha);
    raw.push(fixTitle(result.title));
    raw.push(result.body);

    return GitReader.parseRawCommit(raw.join("\n"), {});
  }

  return _.map(pullRequests, parsePullRequest);
};
