(function () {
    'use strict';

// Loads all our components
    angular.module('SQT.directives', []).directive("fileread", fileread);

    function fileread($rootScope) {
        return {
            link: function (scope, element) {
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

    }

})();