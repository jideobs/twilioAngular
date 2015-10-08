/**
 * Created by jideobs on 6/22/15.
 */
(function () {
    angular.module('twilioAngular', [])
        .provider('twilio', function () {
            var tokenUrl = undefined,
                that = this;

            this.maxTime = 120000; // 2 mins
            this.setTokenUrl = function (url) {
                tokenUrl = url;
            };
            this.$get = ['$rootScope', '$interval', '$http', '$q', 'dateFilter',
                function ($rootScope, $interval, $http, $q, dateFilter) {
                    var $scope = $rootScope.$new(),
                        status_msg = undefined,
                        maxTime = that.maxTime,
                        retry;

                    $scope.$watch('status', function (newValue, oldValue) {
                        // stop if new value is undefined
                        if (newValue === undefined) return;

                        if (newValue === 'connected') {
                            signalParentEle.attr({'class': 'green', 'title': 'Connected'});
                        } else if (newValue === 'disconnected') {
                            signalParentEle.attr({'class': 'red', 'title': 'Disonnected'});
                        } else if (newValue === 'connecting') {
                            var color = (newValue === oldValue) ? 'dark-yellow': 'yellow';
                            signalParentEle.attr({'class': color, 'title': 'Connecting'});
                        } else {
                            signalParentEle.attr({'class': 'dark', 'title': newValue });
                        }
                    });

                    function _setupTwilio(token) {
                        status_msg = 'Connecting to network!';
                        try {
                            Twilio.Device.setup(token, {
                                closeProtection: 'A call is currently in progress, leaving this page will end the call',
                                audioConstraints: {
                                    optional: [
                                        {googAutoGainControl: true}
                                    ]
                                }
                            });

                            Twilio.Device.ready(function (device) {
                                console.log('Connected');
                                $scope.status = 'connected';
                                status_msg = 'You are alright';
                                $rootScope.$broadcast('$agentReady');
                            });

                            Twilio.Device.error(function (error) {
                                $scope.status = 'disconnected';
                                status_msg = 'Disconnected from network';
                                $rootScope.$broadcast("$clientError", error.message);
                            });

                            Twilio.Device.connect(function (conn) {
                                console.log('disconnected');
                                $rootScope.$broadcast("$callConnected", conn);
                            });

                            Twilio.Device.disconnect(function (conn) {
                                $rootScope.$broadcast('$callDropped');
                            });

                            Twilio.Device.incoming(function (conn) {
                                $rootScope.$broadcast('$incomingCall', conn);
                            });

                            Twilio.Device.cancel(function (conn) {
                                $rootScope.$broadcast('$callCanceled')
                            });

                            Twilio.Device.offline(function (conn) {
                                $rootScope.$broadcast('$clientOffline');
                                $scope.status = 'onCall';
                                _reconnect();
                            });
                        } catch (ReferenceError) {
                            $scope.status = 'notAvailable';
                            status_msg = 'No network available, refresh your browser';
                            throw 'Twilio not available'
                        }
                    }

                    function _stopTrying () {
                        $interval.cancel(retry);
                        retry = undefined;
                    }

                    function _getToken(timeout) {
                        var deffered = $q.defer();
                        retry = $interval(function () {
                            $http.get(tokenUrl).success(function (response) {
                                _stopTrying();
                                deffered.resolve(response);
                                var currentDate;
                            }).error(function (reason) {
                                // when maxTime is reached stop retrying
                                if (timeout === maxTime) {
                                    $scope.status = 'disconnected';
                                    status_msg = 'Could not get token from server';
                                    deffered.reject(reason);
                                    _stopTrying();
                                } else {
                                    timeout += 200;
                                    _stopTrying();
                                    currentDate = dateFilter(new Date(), 'mm:ss', {'timeout': timeout});
                                    deffered.notify({'msg': 'Retrying in ' + currentDate});
                                    getToken(timeout);
                                }
                            });
                        }, timeout);
                        return deffered.promise;
                    };

                    function _init() {
                        return _setupTwilio(token);
                    }

                    function _reconnect() {
                        $scope.status = 'connecting';
                        _start();
                    }

                    $rootScope.$on('$destroy', function () {
                        _stopTrying();
                    });

                    return {
                        start: _init,
                        reconnect: _reconnect
                    }
                }]
        })
        .directive('callPanel', ['$rootScope', 'formatPhoneNo', '$interval', 'dateFilter', 'contactSourceService',
            function ($rootScope, formatPhoneNo, $interval, dateFilter, contactSourceService) {
                return {
                    restrict: 'E',
                    scope: {},
                    templateUrl: '/templates/call-panel/component',
                    link: function (scope, ele, attrs) {
                        var panel = ele.children('.call-panel'),
                            callBtns = panel.find('.call-btns'),
                            callBtn = panel.find('#pickup-btn'),
                            muteBtn = panel.find('#mute-btn'),
                        // cancelBtn = panel.find('#hangup-btn'),
                            transferBtn = panel.find('#transfer-btn'), timer,
                            time = 1000;
                        // panel.css('display', 'block');
                        scope.callTime = '--:--';
                        $rootScope.$on('$incomingCall', function (evt, conn) {
                            panel.css('display', 'block');
                            scope.$apply(scope.from = formatPhoneNo(conn.parameters.From));
                            console.log('coming');
                            callBtn.on('click', function () {
                                console.log('picked');
                                conn.accept();
                            });
                        });
                        $rootScope.$on('$callCanceled', function () {
                            callBtns.attr('disabled', 'disabled');
                            $interval.cancel(timer);
                        });
                        $rootScope.$on('$callConnected', function () {
                            // callBtn.css('display', 'none');
                            // transferBtn.css('display', 'block');
                            timer = $interval(function () {
                                scope.callTime = dateFilter(new Date(time), 'mm:ss')
                                time += 1000;
                            }, 1000);

                            // get recent 5 contact records
                            contactSourceService.get($scope.conn)
                                .then(function (response) {
                                    console.log(response);
                                }, function (reason) {
                                    console.log(reason);
                                });
                        });
                        $rootScope.$on('$destroy', function() {
                            $interval.cancel(timer);
                        });
                    }
                }
            }])
        .directive('signal', [function () {
            return {
                restrict: 'A',
                template: '<span class="glyphicon glyphicon-signal"></span>',
                link: function (scope, ele, attrs, ctrl) {
                    ele.on('click', function () {

                    });
                }
            }
        }])
})();
