var exec = require('child-process-promise').exec;
var Q = require('Q');
var shortid = require('shortid');

var host = process.env.host;
var token = process.env.token;

console.log(host, token);

var groupRoute = '/v1/groups/';
var itemRoute = '/v1/items/';

// Known List of Id's to add?
var ids = [];

var groupMemberLengths = [1, 5, 10, 20, 40, ids.length]; // lazy log-ish to max

randomGroupFlow();


// Workflow
function randomGroupFlow() {
  var funcs = [workflowCreateRandomGroupData, workflowCreateGroup, workflowAddRandomGroupMembers, workflowDeleteGroup];
  funcs.reduce(Q.when, Q());
}

function subtract(a, b) { // union / bisect list type stuff
  return a.filter(item => { return b.indexOf(item) < 0; });
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomElements(arr, amount) {
  amount = Math.min(amount, arr.length);
  console.log('Getting', amount, 'Random elements from', arr);
  var newArr = [];
  var tmp;
  while (newArr.length < amount) {
    tmp = getRandomElement(arr);
    if (newArr.indexOf(tmp) < 0) { // unique
      newArr.push(tmp);
    }
  }
  return newArr;
}

function removeGroupMembers(groupId, items) {
  var promises = [];
  items.forEach((itemId) => {
    promises.push(removeGroupMember(groupId, itemId));
  });
  return Q.all(promises);
}

function removeGroupMember(groupId, itemId) {
  return curl(host, url([groupRoute, groupId, '/members/', itemId]), 'DELETE');
}

function workflowCreateRandomGroupData() {
  return { name: shortid.generate(), composition: 'WEIGHTED' };
}

function workflowDeleteGroup(results) {
  var object = extractJsonFromCurlReponse(results);
  return curl(host, url([groupRoute, object.groupId]), 'DELETE');
}

function workflowAddRandomGroupMembers(json) {
  var groupMembers = getRandomElements([].concat(ids), getRandomElement(groupMemberLengths));
  return addMembers(json, groupMembers);
}

function addMembers(json, groupMembers) {
    var promises = [];
    var obj = {};
    groupMembers.forEach(function (itemId) {
        obj = { groupId: json.id, itemId: itemId };
        promises.push(curl(host, url([groupRoute, json.id, '/members/', itemId]), 'POST',  obj));
    });
    console.time('group-' + json.id);
    return Q.all(promises);
}

function workflowCreateGroup(groupObj) {
    var deferred = Q.defer();
    curl(host, groupRoute, 'POST', groupObj).then(function (result) {
        if (result.stdout) {
          try {
            var object = JSON.parse(result.stdout);
            deferred.resolve(object);
          } catch (e) {
            deferred.reject(e);
          }
        } else {
          deferred.reject({ err: 'JSON not returned from api call.' });
        }
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

function curl(host, route, method, json) {
    var args = ['curl',
        '-X', method,
        host + route,
    '-H', "'Pragma: no-cache'",
    '-H', "'Origin: http://abus.er:3000'",
    '-H', "'Referer: http://localhost:3000/'",
    '-H', "'Connection: keep-alive'",
    '-H', "'Accept-Encoding: gzip, deflate'",
    '-H', "'Accept-Language: en-US,en;q=0.8'",
    '-H', "'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36'",
    '-H', "'Content-Type: application/json;charset=UTF-8'",
    '-H', "'Accept: application/json, text/plain, */*'",
    '-H', "'Cache-Control: no-cache'",
    '--compressed'
    ];

    if (token) {
      args.push('-H');
      args.push("'Authorization: Bearer " + token + "'");
    }

    if (json && method == 'POST') {
        args.push('--data-binary', "'" + JSON.stringify(json) + "'");
    }

//    console.log(route, method, json);

    var command = args.join(' ');
    return exec(command);
}

function extractJsonFromCurlReponse(responses) {
  var object;
  var response;
  if (typeof responses === typeof []) {
    result = responses[0];
  } else {
    result = responses;
  }
  return JSON.parse(result.stdout);
}

function url(list) {
  return list.join('');
};

function logspace(start, to, len) {
  var err = 'from must be greater than zero';
  var base = Math.pow(to / start, 1 / len);
  var arr = new Array(len);
  var i = 1;
  if (isNaN(base)) throw new TypeError(err);
  for (; i <= len; ++i) {
    arr[i - 1] = start * Math.pow(base, i);
  }
  return arr;
}
