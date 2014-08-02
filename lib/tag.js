var
  _ = require('lodash'),
  util = require('util');

exports.fromLocalTag = function fromLocalTag(localTag) {
  return new Tag(localTag.name, localTag.date, localTag.sha);
};

exports.custom = function custom(name, date, ref) {
  return new Tag(name, date, ref);
};

function Tag(name, date, ref) {
  var
    version = name,
    fromCommit = null,
    toCommit = ref,
    logs = [];

  function addLog(log) {
    logs.push(log);
  }

  return {
    version: version,
    date: date,
    logs: logs,

    commitFilters: function commitFilters() {
      return util.format('%s..%s', fromCommit, toCommit);
    },
    toCommit: toCommit,
    setFromCommit: function setFromCommit(commit) {
      fromCommit = commit;
    },
    addLogs: function addLogs(newLogs) {
      _.forEach(newLogs, addLog);
    },
    toString: function () {
      return util.format('%s [%s..%s]', version, fromCommit, toCommit);
    }
  };
}
