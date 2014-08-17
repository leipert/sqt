'use strict';

// Loads all our components
angular.module('SQT', [
    'ui.bootstrap',
    'LocalForageModule'
]).directive("fileread", function ($rootScope) {
    return {
        link: function (scope, element, attributes) {
            element.bind("change", function (changeEvent) {
                var reader = new FileReader();
                reader.onload = function (loadEvent) {
                    element.val(null);
                    $rootScope.$broadcast('newConfig', loadEvent.target.result);
                };
                reader.readAsText(changeEvent.target.files[0]);
            });
        }
    }
}).controller('MainCtrl', function ($scope, $q, $http, testService, $localForage, $timeout) {

    var globalConfiguration = {};

    var restoreLastConfig = function () {
        return $q.all({tests: $localForage.getItem('testCollection'), config: $localForage.getItem('config')})
            .then(function (data) {
                if (data !== null && data.config !== null && data.tests !== null) {
                    return data;
                }
                return $http.get('tests.yml').then(loadYAML);
            });
    };

    var loadYAML = function (response) {
        return $q.when(jsyaml.safeLoad(response.data));
    };

    var loadConfig = function (configuration) {
        globalConfiguration = angular.copy(configuration.config);
        $localForage.setItem('config', configuration.config);
        return configuration.tests;
    };

    var runTest = function (test) {
        test.running = true;
        test.$expand = {};
        return $timeout(
            function () {
                testService.runTest(globalConfiguration, test)
                    .then(function (test) {
                        test.$open = !test.success;
                        test.running = false;
                    })
            },
            Math.floor(Math.random() * 1000) + 500);
    };

    var runTestCollection = function (testCollection) {
        var promises = [];
        testCollection.forEach(function (test) {
            promises.push(runTest(test));
        });
        $scope.testCollection = testCollection;
        return $q.all(promises);
    };

    var initialize = function () {
        $scope.$search = {};
        $scope.testRatios = [];
        $scope.testCollection = undefined;

        restoreLastConfig()
            .then(loadConfig)
            .then(runTestCollection);
    };

    initialize();

    $scope.runTest = function (test) {
        runTest(test);
    };

    $scope.runTestCollection = function () {
        runTestCollection($scope.testCollection);
    };

    $scope.getTestStatusClass = function (test) {
        if (test.running) {
            return 'bg-info';
        } else {
            return test.success ? 'bg-success' : 'bg-danger';
        }
    };

    $scope.$on('newConfig', function (event, data) {
        $q.when({data: data})
            .then(loadYAML)
            .then(loadConfig)
            .then(runTestCollection);
    });

    $scope.$watch('testCollection', function (nv) {
        if (_.isArray(nv)) {
            $localForage.setItem('testCollection', nv);
            var running = _.filter(nv, {running: true}).length;
            $scope.running = running > 0;
            var success = _.filter(nv, {running: false, success: true}).length;
            var failure = _.filter(nv, {running: false, success: false}).length;
            var total = nv.length;
            if (total > 0) {
                $scope.testRatios = [
                    {value: running * 100 / total, amount: running, total: total, type: 'default', text: 'running'},
                    {value: success * 100 / total, amount: success, total: total, type: 'success', text: 'successful'},
                    {value: failure * 100 / total, amount: failure, total: total, type: 'danger', text: 'failed'}
                ];
            }
        }
    }, true);

}).factory('testService', function ($q, $log) {
    _.mixin(_.str.exports());

    var factory = {};
    var service = jassa.service;

    var tester = {
        isEmpty: function (data) {
            var success = (data.length === 0), message = '';
            if (!success) {
                message = 'Expected query result to be empty. It contained ' + data.length + ' items.';
            }
            return {success: success, message: message}
        },
        isNotEmpty: function (data) {
            var success = (data.length > 0), message = '';
            if (!success) {
                message = 'Expected query result to be not empty';
            }
            return {success: success, message: message}
        }
    };

    factory.runTest = function (config, test) {
        var config = angular.copy(config);
        return factory.runQuery(_.merge(config, test.config), test.query)
            .then(function (data) {
                var results = {
                    $queryResults: JSON.stringify(data, null, 2),
                    $testResults: {},
                    success: true
                };
                _.forIn(test.expect, function (value, key) {
                    if (tester.hasOwnProperty(key)) {
                        results.$testResults[key] = tester[key](data, value);
                        results.success = results.success && results.$testResults[key].success;
                    }
                });
                return _.merge(test, results);
            }).catch(function () {
                return _.merge(test, {
                    $queryResults: 'none',
                    $testResults: {
                        connectToServer: {
                            success: false,
                            message: 'Could Not Connect to ' + test.config.url
                        }
                    },
                    success: false
                })
            })
    };

    factory.runQuery = function (config, query) {
        var sparqlService = new service.SparqlServiceHttp(
            config.url,
            [config.graph]
        );
        var qe = sparqlService.createQueryExecution(query);
        qe.setTimeout(config.timeout); // timeout in milliseconds

        return $q.when(qe.execSelect()).then(
            function (response) {
                var ret = [];
                while (response.hasNext()) {
                    ret.push(
                        JSON.parse(response.nextBinding().toString()));
                }
                return ret;
            }
        );
    };
    return factory;
});