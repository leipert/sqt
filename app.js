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
                    $rootScope.$broadcast('newConfig',loadEvent.target.result);
                };
                reader.readAsText(changeEvent.target.files[0]);
            });
        }
    }
}).controller('MainCtrl', function ($scope, $q, $http, $log, testService, $localForage) {
    $scope.$on('newConfig',function(event,data){
        $scope.running = true;
        $q.when({data:data}).then(loadYaml).then(runTests).then(function () {
            $scope.running = false;
        });
    });

    var loadYaml = function (response) {
        return $q.when(jsyaml.safeLoad(response.data));
    };

    var runTests = function (configuration) {
        var promises = [];
        configuration.tests.forEach(function (test) {
            test.running = true;
            promises.push(
                testService.runTest(configuration.config, test)
                    .then(function (test) {
                        test.$open = !test.success;
                        test.running = false;
                    })
            );
        });
        $localForage.setItem('config', configuration.config);
        $scope.tests = configuration.tests;
        return $q.all(promises);
    };

    $scope.running = true;

    $q.all({tests: $localForage.getItem('tests'), config: $localForage.getItem('config')})
        .then(function (data) {
            if (data !== null && data.hasOwnProperty('config') && data.hasOwnProperty('tests')) {
                return data;
            }
            return $http.get('tests.yml').then(loadYaml);
        }).then(runTests).then(function () {
            $scope.running = false;
        });

    $scope.finishedTests = function () {
        return _.filter($scope.tests, {running: false}).length;
    };

    $scope.finishedTestsRatio = function () {
        return $scope.finishedTests() / $scope.tests.length * 100;
    };

    $scope.testRatios = [];

    $scope.getStatusClass = function (test) {
        if (!test.running) {
            return test.success ? 'bg-success' : 'bg-danger';
        } else {
            return 'bg-info';
        }
    };

    $scope.$watch('tests', function (nv) {
        if (_.isArray(nv)) {
            $localForage.setItem('tests', angular.copy(nv)).then(function () {
                $log.warn("saved")
            });
            $log.warn(nv);
            var running = _.filter(nv, {running: true}).length;
            var success = _.filter(nv, {running: false, success: true}).length;
            var failure = _.filter(nv, {running: false, success: false}).length;
            var total = nv.length;
            if (total > 0) {
                $scope.testRatios = [
                    {value: running * 100 / total, amount: running, total: total, type: 'default', text: 'running'},
                    {value: success * 100 / total, amount: success, total: total, type: 'success', text: 'successful'},
                    {value: failure * 100 / total, amount: failure, total: total, type: 'danger', text: 'failed'}
                ];
                $log.warn($scope.testRatios);
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

    factory.runTest = function (globalConfig, test) {
        return factory.runQuery(_.merge(globalConfig, test.config), test.query)
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