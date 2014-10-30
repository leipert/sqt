(function () {
    'use strict';


// Loads all our components
    angular.module('SQT.filters', [])
        .filter('replaceURIsWithPrefixes', replaceURIsWithPrefixes)
        .filter('beautifyDurations', beautifyDurations);

    function replaceURIsWithPrefixes() {
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
    }

    function beautifyDurations() {
        return function (array, max) {
            var string = "";
            _.forEach(array, function (duration) {
                var percent = Math.round(duration * 40 / max);
                string += _.repeat('█', percent);
                string += _.repeat('░', 40 - percent);
                string += ' ' + _.padLeft(duration, max.length) + ' ms'
                string += '\n';
            });
            return string;
        }
    }

})();