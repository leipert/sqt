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

    var prefixes = {
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'xsd': 'http://www.w3.org/2001/XMLSchema#',
        'wsg82': 'http://www.w3.org/2003/01/geo/wgs84_pos#'
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
        console.warn(configuration)
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

    var runTest = function (test) {
        test.running = true;
        test.$expand = {};
        test.$testResults = undefined;
        test.config = _.merge(angular.copy(globalConfiguration), test.config);
        return $timeout(
            function () {
                testService.runTest(test)
                    .then(function (result) {
                        test = _.merge(test, result);
                        test.$open = !test.success;
                        test.running = false;
                    })
            },
            Math.floor(Math.random() * 1000) + 500);
    };

    var runTestCollection = function (testCollection) {
        var promises = [];
        testCollection = _.filter(testCollection, _.isObject);
        testCollection.forEach(function (test) {
            promises.push(runTest(test));
        });
        $scope.testCollection = testCollection;
        return $q.all(promises);
    };

    var initialize = function () {
        $scope.$search = {};
        $scope.testRatios = [];
        $scope.totalCount = 0;
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
            .then(runTestCollection)
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
                $localForage.setItem('testCollection', angular.copy(nv));
                var successCount = _.filter(nv, {running: false, success: true}).length;
                var failCount = _.filter(nv, {running: false, success: false}).length;
                $scope.testRatios = {
                    running: {
                        value: Math.floor(runningCount * 100 / $scope.totalCount),
                        amount: runningCount,
                        type: 'default'
                    },
                    successful: {
                        value: Math.floor(successCount * 100 / $scope.totalCount),
                        amount: successCount,
                        type: 'success'
                    },
                    failed: {value: Math.floor(failCount * 100 / $scope.totalCount), amount: failCount, type: 'danger'}
                };
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

}).factory('testService', function ($q) {
    _.mixin(_.str.exports());

    var factory = {};
    var service = jassa.service;

    var testSuite = {
        isEmpty: {
            test: function (data) {
                return _.isEmpty(data)
            },
            message: 'Expected result to be empty.'
        },
        isNotEmpty: {
            test: function (data) {
                return !_.isEmpty(data)
            },
            message: 'Expected result not to be empty.'
        },
        contains: {
            test: function (data, value) {
                return (!_.isUndefined(_.find(data, value)));
            },
            message: 'Expected data to contain:'
        },
        containsNot: {
            test: function (data, value) {
                return (_.isUndefined(_.find(data, value)));
            },
            message: 'Expected data not to contain:'
        }
    };

    var parseResult = function (response) {
        var ret = [];
        while (response.hasNext()) {
            ret.push(
                JSON.parse(response.nextBinding().toString()));
        }
        return ret;
    };

    var runQuery = function (config, query) {
        if (!_.isArray(config.graph)) {
            config.graph = [config.graph];
        }
        if (!_.isNumber(config.timeout)) {
            config.timeout = 5000;
        }
        var sparqlService = new service.SparqlServiceHttp(
            config.url,
            config.graph
        );
        var prefixes = _.reduce(config.prefixes, function (result, url, prefix) {
            return result + 'PREFIX ' + prefix + ': <' + url + '>\n';
        }, '');
        var qe = sparqlService.createQueryExecution(prefixes + query);
        qe.setTimeout(config.timeout); // timeout in milliseconds

        return $q.when(qe.execSelect()).then(parseResult);
    };

    var getTestResults = function (test, response) {
        var result = {
            $queryResults: JSON.stringify(response, null, 2),
            success: true
        };
        if (!_.isEmpty(test.expect)) {
            result.$testResults = {};
            test.expect.forEach(function (test) {
                var expectedValue = null;
                var testName = test;
                if (_.isObject(test)) {
                    testName = _.findKey(test);
                    expectedValue = test[testName];
                }
                if (testSuite.hasOwnProperty(testName)) {
                    var success = testSuite[testName].test(response, expectedValue);
                    result.$testResults[testName] = {
                        success: success,
                        expected: expectedValue,
                        message: testSuite[testName].message
                    };
                    result.success = result.success && success;
                } else {
                    result.$testResults[testName] = {
                        success: false,
                        message: "A test named " + testName + " does not exist"
                    };
                    result.success = false;
                }
            });
        }
        return result;
    };

    var createErrorMessage = function (errorName, errorMessage, results) {
        var deferred = $q.defer();
        var ret = {
            $queryResults: results,
            $testResults: {},
            success: false
        };
        ret.$testResults[errorName] = {
            success: false,
            message: errorMessage
        };
        deferred.resolve(ret);
        return deferred.promise;

    };


    var connectionError = function (data) {
        var responseText = _.isEmpty(data.responseText) ? 'none' : data.responseText;
        var message = 'Could not connect to the sparql endpoint';
        if (data.status !== 0) {
            message = 'Status: ' + data.status + ' (' + data.statusText + ')'
        }
        return createErrorMessage('Connection Error', message, responseText);
    };

    factory.runTest = function (t) {
        var test = angular.copy(t);
        if (_.isEmpty(test.query)) {
            return createErrorMessage('No query defined', 'You should define a SPARQL Query.', 'none');
        }
        if (_.isEmpty(test.config) || _.isEmpty(test.config.url)) {
            return createErrorMessage('No endpoint defined', 'You should define a SPARQL Endpoint.', 'none');
        }
        return runQuery(test.config, test.query)
            .then(function (response) {
                return getTestResults(test, response);
            })
            .catch(connectionError);
    };
    return factory;

}).
    filter('replaceURIsWithPrefixes', function () {
        return function (string, prefixes) {
            if (_.isString(string)) {
                for (var key in prefixes) {
                    if (prefixes.hasOwnProperty(key)) {
                        var regex = new RegExp('<?' + prefixes[key] + '(\\w+)>?', 'ig');
                        string = string.replace(regex, key + ':$1');
                    }
                }
            }
            return string;
        };
    })
;