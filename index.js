var exec = require('child-process-promise').exec;
var Q = require('Q');
var shortid = require('shortid');

var host="http://forecasts-api-local.intensity.internal";

var token="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2ludGVuc2l0eS1sb2NhbC5hdXRoMC5jb20vIiwic3ViIjoiYXV" +
    "0aDB8NTcxNTM3YjE3NGFmMGJmNTJlZWZhMGYzIiwiYXVkIjoiYXpEOTU5YTFhZjF6aVZDbVUyMkNTTXFEUzBOMmtRT0QiLCJleHAiOjE0NjI5Mzc0ND" +
    "csImlhdCI6MTQ2MjkwMTQ0N30.D0XP4XewaPjUHJCL9qvMGzUroah5MIdTS9qFUP4D08Q";
var groupRoute = "/v1/groups";

var groupsToPopulate  = 10;

var ids = [9, 17, 57, 58, 65, 79, 87, 93, 94, 98, 117, 177, 202, 252, 257, 260, 304, 354, 388, 406, 421, 473, 491,
    515, 535, 538, 545, 550, 553, 578, 638, 642, 646, 656, 660, 707, 742, 762, 790, 847, 850, 851, 858, 926, 950, 991,
    1124, 1160, 1176, 1184, 1238, 1257, 1288, 1351, 1360, 1368, 1396, 1398, 1568, 1573, 1645, 1654, 1663, 1675, 1705,
    1742, 1748, 1794, 1832, 1833, 2058, 2481];

var groupMemberLengths = [1, 5, 10 , 20, 40, ids.length];
var randomAmount = getRandomElement(groupMemberLengths);
createGroupWithMembers(randomAmount);

var amount = 10;
var a = getRandomElements([].concat(ids), amount);
console.log("a", a.sort());
var b = getRandomElements(a, amount - 5);
console.log("b", b.sort());
var c = subtract(a,b);
console.log("c", c.sort());

function subtract(a, b) {
  return a.filter(function(item) {
    return b.indexOf( item ) < 0;
  });
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomElements(arr, amount) {
  amount = Math.min(amount, arr.length);
  console.log("Getting", amount, "Random elements");
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
  items.forEach(function (itemId) {
    promises.push(removeGroupMember(groupId, itemId));
  });
  return Q.all(promises);
}

function removeGroupMember(groupId, itemId) {
  return curl(host, ["/v1/groups/", groupId, "/members/", itemId], "DELETE");
}

function createGroupWithMembers(amount) {
    var groupJson = {name: shortid.generate(), composition: "WEIGHTED"};
    createGroup(groupJson).then(function(newGroupInfo) {
        var groupMembers = getRandomElements([].concat(ids), amount);
        addMembers(newGroupInfo.id, groupMembers).then(function(returns) {
          curl(host, ["/v1/items/", newGroupInfo.id, '/datasets'].join(""), "GET", {}).then(function(result) {
            console.log(amount, "items");
            console.timeEnd("group-" + newGroupInfo.id);
            curl(host, ["/v1/groups/", newGroupInfo.id].join(""), "DELETE").then(function(result){})
          })
        });
    });
}

function addMembers (groupId, groupMembers) {
    var promises = [];
    var obj = {};
    groupMembers.forEach(function (itemId) {
        obj = {"groupId": groupId, "itemId":itemId};
        promises.push(curl(host, ["/v1/groups/", groupId, "/members/", itemId].join(""), "POST",  obj))
    });
    console.time("group-" + groupId);
    return Q.all(promises);
}

function createGroup (groupObj) {
    var deferred = Q.defer();
    curl(host, groupRoute, 'POST', groupObj).then(function(result) {
        var object = JSON.parse(result.stdout);
        deferred.resolve(object);
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

function curl(host, route, method, json, token) {
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

    if(json && method == "POST") {
        args.push('--data-binary', "'" + JSON.stringify(json) + "'");
    }

    var command = args.join(" ");
    return exec(command)
}
