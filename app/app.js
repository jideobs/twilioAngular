'use strict';

// Declare app level module which depends on views, and components
angular.module('myApp', ['twilioAngular']).
    config(function(twilioProvider, $interpolateProvider) {
        $interpolateProvider.startSymbol('[[');
        $interpolateProvider.endSymbol(']]');
    }).run(function (twilio) {
        twilio.start();
    })

    .controller('MainCtrl', function ($rootScope, $scope) {
        $scope.incomingCall = false;

        $rootScope.$on('$callConnected', function () {
            $scope.connected = true;
        });

        $rootScope.$on('$incomingCall', function (evt, conn) {
            $scope.incomingCall = true;
            $scope.pickUp = function () {
                conn.connect();
            };

            $scope.hangUp = function () {
                conn.disconnect();
            }
        });
    });

