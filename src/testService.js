(function() {


    'use strict';

// Loads all our components
    angular.module('SQT.testService', [])
        .
        factory('testService', testService);

    function testService($q) {
        var factory = {};
        var jassa = new Jassa(Promise, $.ajax);
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

    }
})();