(function () {
    'use strict';


// Loads all our components
    angular.module('SQT', [
        'ui.bootstrap',
        'LocalForageModule',

        'SQT.directives',
        'SQT.filters',
        'SQT.testService'
    ]).controller('MainCtrl', MainCtrl);

    function MainCtrl($scope, $q, $http, testService, $localForage, $timeout) {

        $scope.autoOpen = false;

        $scope.benchMarkRuns = 10;

        var prefixes = {
            'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'owl': 'http://www.w3.org/2002/07/owl#',
            'xsd': 'http://www.w3.org/2001/XMLSchema#',
            'wsg84': 'http://www.w3.org/2003/01/geo/wgs84_pos#'
        };

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
            var deferred = $q.defer();
            if (_.isEmpty(configuration) || _.isEmpty(configuration.config) || _.isEmpty(configuration.tests)) {
                deferred.reject();
            } else {
                $scope.hasInvalidConfig = false;
                globalConfiguration = angular.copy(configuration.config);
                globalConfiguration.prefixes = _.merge(globalConfiguration.prefixes, prefixes);
                $localForage.setItem('config', angular.copy(configuration.config));
                deferred.resolve(configuration.tests);
            }
            return deferred.promise;
        };

        var runTest = function (test, cb) {
            test.$expand = {};
            test.$testResults = undefined;
            if (!test.hasOwnProperty('$duration')) {
                test.$duration = {
                    list: [],
                    total: 0,
                    max: 1
                }
            }
            if (typeof cb !== 'function') {
                cb = function (data) {
                    return data;
                };
            }
            test.config = _.merge(angular.copy(globalConfiguration), test.config);
            return function () {
                var start = moment();
                return testService.runTest(test)
                    .then(function (result) {
                        test = _.merge(test, result);
                        test.$open = test.$open || !test.success && $scope.autoOpen;
                        var diff = moment().diff(start);
                        test.$duration.list.unshift(diff);
                        test.$duration.total += diff;
                        if (diff > test.$duration.max) {
                            test.$duration.max = diff;
                        }
                    }).then(cb());
            }

        };

        var promises = [];
        var isRunning = false;

        var workQueue = function () {
            if (!isRunning) {
                isRunning = true;
                if (promises.length > 0) {
                    promises.shift()().then(function () {
                        isRunning = false;
                        $timeout(function(){
                            workQueue();
                        },100);
                    });
                }
                else {
                    isRunning = false;
                }
            }
        };

        var setupTest = function (test, lastRun) {
            test.running = true;
            if (lastRun) {
                promises.push(runTest(test, function () {
                    test.running = false;
                }));
            } else {
                promises.push(runTest(test));
            }
        };

        var setupTestCollection = function (testCollection, benchmark) {
            if (!_.isNumber(benchmark)) {
                benchmark = 1;
            }
            testCollection = _.filter(testCollection, _.isObject);
            $scope.testCollection = testCollection;
            testCollection.forEach(function (test) {
                for (var i = 1; i <= benchmark; i++) {
                    setupTest(test, (benchmark === i));
                }
            });
            return $q.when(testCollection);
        };

        var initialize = function () {
            $scope.$search = {};
            $scope.testRatios = [];
            $scope.totalCount = 0;
            $scope.testCollection = undefined;

            restoreLastConfig()
                .then(loadConfig)
                .then(setupTestCollection)
                .then(function(){
                    $timeout(workQueue,100);
                });
        };

        initialize();

        $scope.runTest = function ($event, test) {
            $event.stopPropagation();
            setupTest(test, true);
            workQueue();
        };

        $scope.runBenchmark = function ($event, test) {
            $event.stopPropagation();
            for (var i = 1; i <= $scope.benchMarkRuns; i++) {
                setupTest(test,i === $scope.benchMarkRuns);
            }
            workQueue();
        };

        $scope.runTestCollectionBenchmark = function () {
            setupTestCollection($scope.testCollection, $scope.benchMarkRuns).then(workQueue)
        };

        $scope.runTestCollection = function () {
            setupTestCollection($scope.testCollection).then(workQueue);
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
                .then(setupTestCollection)
                .then(workQueue)
                .catch(function () {
                    $scope.hasInvalidConfig = true;
                });
        });

        $scope.$watch('testCollection', function (nv) {
            if (_.isArray(nv)) {
                $scope.totalCount = nv.length;
                var runningCount = _.filter(nv, {running: true}).length;
                $scope.running = runningCount > 0;
                if ($scope.totalCount > 0) {
                    var copy = _.map(_.cloneDeep(nv), function (test) {
                        return _.omit(test, function (value, key) {
                            return _.startsWith(key, '$');
                        });
                    });
                    $localForage.setItem('testCollection', copy);
                    var successCount = _.filter(nv, {running: false, success: true}).length;
                    var failCount = _.filter(nv, {running: false, success: false}).length;
                    $scope.testRatios = [
                        {
                            label: 'failed',
                            value: Math.floor(failCount * 100 / $scope.totalCount),
                            amount: failCount,
                            type: 'danger'
                        },
                        {
                            label: 'successful',
                            value: Math.floor(successCount * 100 / $scope.totalCount),
                            amount: successCount,
                            type: 'success'
                        },
                        {
                            label: 'running',
                            value: Math.floor(runningCount * 100 / $scope.totalCount),
                            amount: runningCount,
                            type: 'default'
                        }


                    ];
                    var sum = _.reduce(_.pluck($scope.testRatios, 'value'), function (sum, c) {
                        return sum + c
                    });
                    if (sum < 100) {
                        var max = _.findKey($scope.testRatios, _.max($scope.testRatios, 'value'));
                        $scope.testRatios[max].value += 100 - sum;
                    }
                }
            }
        }, true);

    }
})();