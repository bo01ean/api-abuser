const exec = require('child-process-promise').exec;
const Q = require('Q');
const shortid = require('shortid');

const host = process.env.host;
const token = process.env.token;

console.log(host, token);

const groupRoute = '/v1/groups/';
const itemRoute = '/v1/items/';

var path = 'v1';
path = 'earnings';
const maxRunners = 100;

var Worker = function (path) {

  var searchRoute = '/' + path + '/items';
  var dashboardsRoute = '/' + path + '/dashboards';
  var chartsRoute = '/' + path + '/charts';

  var ids = [];
  var dashboardId;
  var id = shortid.generate();

  this.workflowMakeList = function (response) {
    var objects = JSON.parse(response.stdout);
    objects.forEach((obj) => {
      ids.push(obj.id);
    });
    return ids;
  };

  this.workflowAddItemsToChart = function (response) {
    var data = JSON.parse(response.stdout);
    var randomList = getRandomElements([].concat(ids), getRandomInt(1, 10));

    //console.log('Adding: ', randomList, 'to:', data.id);
    var promises = [];
    randomList.forEach((item) => {
       promises.push(curl(url([chartsRoute, '/', data.id.toString(), '/items']),
       'POST',
       { itemId: item, chartId: data.id, color: '#29ABDE', style: 'Item->dash' }));
    });
    return Q.all(promises);
  };

  this.workflowAddChartToDashboard = function (response) {
    var data = JSON.parse(response.stdout);
    dashboardId = data.id;
    var object = { dashboardId: data.id, name: shortid.generate(), ordinal: 1, displayMode: 'GRAPH', xinc: 'QUARTER', forecastType: 'SNAPSHOT', zoomType: 1, style: 'expanded' };
    return curl(chartsRoute, 'POST', object);
  };

  this.workflowDeleteDashboard = function (response) {
    return curl(url([dashboardsRoute, '/', dashboardId.toString()]), 'DELETE');
  };

  this.funcs = [
    function () {
      console.time('run-' + id);
    },
    workFlowSearch, this.workflowMakeList, workflowAddDashboard,
    this.workflowAddChartToDashboard, this.workflowAddItemsToChart,
    workflowDeleteChart, this.workflowDeleteDashboard,
    function (r) {
      console.timeEnd('run-' + id);
    }];//workflowCreateChart];//, workflowAddRandomItems, workflowDeleteChart];
  this.run = function () {
    this.funcs.reduce(Q.when, Q());
  };
  function workFlowSearch() {
    return curl(url([searchRoute, '?limit=10000&q=%25']), 'GET');
  }

  function workflowAddDashboard(list) {
    //console.log(list);
    var object = { name: 'Dashboard ' + shortid.generate(), ordinal: 1 };
    return curl(dashboardsRoute, 'POST', object);
  }

  function workflowDeleteChart(response) {
      var data = extractJsonFromCurlReponse(response);
      //console.log(data);
      return curl(url([chartsRoute, '/', data.chartId.toString()]), 'DELETE');
  }

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

    //console.log('Getting', amount, 'Random elements from', arr);
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
    return curl(url([groupRoute, groupId, '/members/', itemId]), 'DELETE');
  }

  function workflowCreateRandomGroupData() {
    return { name: shortid.generate(), composition: 'WEIGHTED' };
  }

  function workflowDeleteGroup(results) {
    var object = extractJsonFromCurlReponse(results);
    return curl(url([groupRoute, object.groupId]), 'DELETE');
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
          promises.push(curl(url([groupRoute, json.id, '/members/', itemId]), 'POST',  obj));
      });
      console.time('group-' + json.id);
      return Q.all(promises);
  }

  function workflowCreateGroup(groupObj) {
      var deferred = Q.defer();
      curl(groupRoute, 'POST', groupObj).then(function (result) {
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

  function curl(route, method, json) {
      var args = ['curl',
          '-X', method,
          "'" + host + route + "'",
      '-H', "'Pragma: no-cache'",
      '-H', "'Origin: http://localhost:3000'",
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

      //console.log(route, method, json);
      var command = args.join(' ');

      // console.log(command);

      //console.log(command);
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
    var indexToPop;
    var params = list.filter((partial, index) => {
      if (partial.match(/^\?/)) {
        indexToPop = index;
        return true;
      }
    });

    if (indexToPop) {
      list.splice(indexToPop, 1);
    }
    var url = list.join('') + params.join('');

    //console.log(url);
    return url;
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

  function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};

var runners = [];

while (runners.length < maxRunners) {
  runners.push(new Worker(path));
  runners[runners.length - 1].run();
}

//var groupMemberLengths = [1, 5, 10, 20, 40, ids.length]; // lazy log-ish to max
//randomGroupFlow();
