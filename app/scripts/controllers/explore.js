'use strict';

// ocpu.seturl("http://localhost:5436/ocpu/library/inteRsense/R");
ocpu.seturl("https://public.opencpu.org/ocpu/github/mdragunski/inteRsense/R");

angular.module('openSenseMapApp')
  .controller('ExploreCtrl', [ '$rootScope', '$scope', '$http', '$filter', '$timeout', '$location', '$routeParams', 'OpenSenseBoxes', 'OpenSenseBoxesSensors', 'OpenSenseBox', 'OpenSenseBoxData', 'leafletEvents', 'validation', 'ngDialog', 'leafletData', 'OpenSenseBoxAPI',
    function($rootScope, $scope, $http, $filter, $timeout, $location, $routeParams, OpenSenseBoxes, OpenSenseBoxesSensors, OpenSenseBox, OpenSenseBoxData, leafletEvents, Validation, ngDialog, leafletData, OpenSenseBoxAPI) {
      $scope.osemapi = OpenSenseBoxAPI;
      $scope.selectedMarker = '';
      $scope.selectedMarkerData = [];
      $scope.markers = [];
      $scope.mapMarkers = [];
      $scope.pagedMarkers = [];
      $scope.prom;
      $scope.delay = 60000;
      $scope.searchText = '';
      $scope.detailsPanel = false;
      $scope.filterPanel = false;
      $scope.downloadPanel = false;
      $scope.image = "placeholder.png";

      // side panel statuses
      $scope.sidebarActive = false;
      $scope.editIsCollapsed = true;
      $scope.deleteIsCollapsed = true;
      $scope.editableMode = false;

      // variables for charts
      $scope.oneAtATime = true;
      $scope.lastData = [];  //Store data from the selected sensor
      $scope.values = [];
      $scope.currentState = ''; //Check state of plots

      // show interpolation when url contains "/interpolation"
      // see explore.html <div ng-show="interpolationPanel">
      if($location.path().indexOf("/interpolation") === 0) {
        $scope.sidebarActive = true;
        $scope.interpolationPanel = true;
      }

      // todo: make this globally accessible, used in registration as well
      $scope.phenomenoms = [
        {value: 1, text: 'Temperatur', unit:'°C', type:'BMP085'},
        {value: 2, text: 'Luftfeuchtigkeit', unit:'%', type:'DHT11'},
        {value: 3, text: 'Luftdruck', unit:'Pa', type:'BMP085'},
        {value: 4, text: 'Schall', unit:'Pegel', type:'LM386'},
        {value: 5, text: 'Licht', unit:'Pegel', type:'GL5528'},
        {value: 6, text: 'Licht (digital)', unit: 'lx', type: 'TSL2561'},
        {value: 7, text: 'UV', unit: 'µW/cm²', type: 'GUVA-S12D'},
        {value: 8, text: 'Kamera', unit: '', type: ''},
      ];

      $scope.dateNow = new Date();
      $scope.downloadform = {};
      $scope.downloadform.daysAgo = 1;
      $scope.downloadform.dateTo = new Date();
      $scope.$watch('downloadform.daysAgo', function(){
        $scope.downloadform.dateFrom = new Date((new Date()).valueOf() - 1000*60*60*24*$scope.downloadform.daysAgo);
      });

      $scope.center = {
        lat: 51.04139389812637,
        lng: 10.21728515625,
        zoom: 6
      };

      $scope.counter = 3;
      $scope.timeout;

      $scope.stopcountdown = function() {
        $timeout.cancel($scope.countdown);
      };

      $scope.countdown = function () {
        if ($scope.counter === 0) {
          ngDialog.close();
          $scope.stopcountdown();
        } else {
          $scope.counter--;
          $scope.timeout = $timeout($scope.countdown,1000);
          switch($scope.counter){
            case 1:
              document.getElementById("zundungheader").innerHTML = "<strong>EINS</strong>";
              break;
            case 2:
              document.getElementById("zundungheader").innerHTML = "<strong>ZWEI</strong>";
              break;
            case 3:
              document.getElementById("zundungheader").innerHTML = "<strong>DREI</strong>";
              break;
          }
        }
      }

      $scope.launch = function () {
        document.getElementById("rocket").remove();
        document.getElementById("zundungheader").innerHTML = "<strong>DREI</strong>";
        $scope.timeout = $timeout($scope.countdown,1000);
      }

      var photonikBoxes = ["54e8e1dea807ade00f880978",
        "54d7c2361b93e97007516a19",
        "54e5e5e5a807ade00f851f81",
        "54e5e723a807ade00f852049",
        "54e9f616a807ade00f89d3cf",
        "54e4c395a807ade00f84e6e0",
        "54e6fc60a807ade00f85a918",
        "54e86f19a807ade00f877342",
        "54e7a5faa807ade00f868aab",
        "54eb6d1ea807ade00f8c459e"
      ];

      $scope.$on('ngDialog.closing', function (e, $dialog) {
        OpenSenseBoxes.query(function(response){
          for (var i = 0; i <= response.length - 1; i++) {
            var tempMarker = {};
            tempMarker.phenomenons = []
            tempMarker.lng = response[i].loc[0].geometry.coordinates[0];
            tempMarker.lat = response[i].loc[0].geometry.coordinates[1];
            tempMarker.id = response[i]._id;
            if (_.contains(photonikBoxes, tempMarker.id)) {
              tempMarker.icon = icons.iconG;
            } else {
              tempMarker.icon = icons.iconC;
            }
            tempMarker.name = response[i].name;
            tempMarker.sensors = response[i].sensors;
            tempMarker.image = response[i].image;
            for (var j = response[i].sensors.length - 1; j >= 0; j--) {
              tempMarker.phenomenons.push(response[i].sensors[j].title);
            };
            $scope.markers.push(tempMarker);
          }
          $scope.mapMarkers = $scope.markers;
        });
      });

      //helper function to zoomTo object for filter sidebar
      $scope.zoomTo = function(lat,lng) {
        $scope.center.lat = lat;
        $scope.center.lng = lng;
        $scope.center.zoom = 15;
      };

      $scope.added = function(file,event) {
        if ((file.getExtension() === "jpg" || file.getExtension() === "png" || file.getExtension() === "jpeg") && file.size < 1500000) {
          return true;
        } else {
          return false;
        }
      }

      if ($routeParams.boxid !== undefined) {
        //TODO find boxid
        OpenSenseBox.query({boxId:$routeParams.boxid}, function(response) {
          $scope.sidebarActive = true;
          $scope.detailsPanel = false;
          $scope.downloadPanel = false;
          $scope.filterPanel = false;
        
          $scope.selectedMarker = response;
          $rootScope.selectedBox = $scope.selectedMarker._id;
          if($location.path().indexOf("/explore") === 0) {
            $scope.detailsPanel = true;
          } else if($location.path().indexOf("/download") === 0) {
            $scope.downloadPanel = true;
          }

          if ($scope.selectedMarker.image === undefined || $scope.selectedMarker.image === "") {
            $scope.image = "placeholder.png";
          } else {
            $scope.image = $scope.selectedMarker.image;
          }
          $scope.getMeasurements();
          var lat = response.loc[0].geometry.coordinates[1];
          var lng = response.loc[0].geometry.coordinates[0];
          $scope.zoomTo(lat,lng);
        });
      }
      if($location.path().indexOf("/download") === 0) {
        $scope.sidebarActive = true;
        $scope.detailsPanel = false;
        $scope.filterPanel = false;
        $scope.downloadPanel = true;
      }

      $scope.downloadArduino = function () {
        var boxId = "";
        if ($scope.selectedMarker.id === undefined) {
          boxId = $scope.selectedMarker._id;
        } else {
          boxId = $scope.selectedMarker.id;
        }
        Validation.checkApiKey(boxId,$scope.apikey.key).then(function(status){
          if (status === 200) {
            document.getElementById("downloadlink").href = "files/"+boxId+".ino";
            $timeout(function() {
              document.getElementById("downloadlink").click();
            }, 100);
            $scope.downloadArduino = false;
          } else {

          }
        });
      }

      $scope.tmpSensor = {};

      $scope.filterOpts = [
        {name:'Phänomen'},
        {name:'Name'},
      ];
      $scope.selectedFilterOption = 'Phänomen';

      

      var icons = {
        iconC: {
          type: 'awesomeMarker',
          prefix: 'fa',
          icon: 'cube',
          markerColor: 'red',
        },
        iconG: {
          type: 'awesomeMarker',
          prefix: 'fa',
          icon: 'cube',
          markerColor: 'green'
        }
      };

      $scope.openDialog = function () {
        $scope.launchTemp = ngDialog.open({
          template: '../../views/app_info_modal.html',
          className: 'ngdialog-theme-default',
          scope: $scope,
          showClose: false,
          controller: ['$scope', '$filter', function($scope, $filter) {
            // controller logic
          }]
        });
      }

      if ($location.path() === "/launch") {
        ngDialog.open({
          template: '../../views/launch_modal.html',
          className: 'ngdialog-theme-flat ngdialog-theme-custom',
          scope: $scope
        });
      }

      $scope.$watchCollection('searchText', function(newValue, oldValue){
        if (newValue === oldValue) {
          return;
        };

        var data = angular.copy($scope.markers);

        var justGroup = _.filter(data, function(x) {
          if ($scope.selectedFilterOption == "Phänomen") {
            if (newValue == '' | newValue == undefined) {
              if (!newValue) {
                return true;
              } else{
                for(var i in x.sensors) {
                  $filter('filter')([x.sensors[i].title], newValue).length > 0;
                }
              };
            } else {
              for(var i in x.sensors) {
                if ($filter('filter')([x.sensors[i].title], newValue).length > 0) {
                  return x;
                };
              }
            };
          } else if($scope.selectedFilterOption == "Name") {
            if (newValue == '' | newValue == undefined) {
              if (!newValue) {
                return true;
              } else{
                $filter('filter')([x.name], newValue).length > 0;
              };
            } else {
              if ($filter('filter')([x.name], newValue).length > 0) {
                return x;
              };
            };
          };

        });
        data = justGroup;
        $scope.mapMarkers = data;
      });

      $scope.closeSidebar = function() {
        $scope.sidebarActive = false;
        $scope.editIsCollapsed = false;
        $scope.deleteIsCollapsed = false;
        $scope.downloadIsCollapsed = false;
        $scope.selectedMarker = '';
        $scope.editableMode = false;
        $scope.apikey.key = '';
        $scope.stopit();
        $location.path('/explore', false);
      }

      $scope.saveChange = function (event) {
        console.log("Saving change");
        var boxid = $scope.selectedMarker.id || $scope.selectedMarker._id;
        var imgsrc = angular.element(document.getElementById("image")).attr('src');
        var newBoxData = {
          tmpSensorName: $scope.tmpSensor.name, 
          image:imgsrc
        }
        $http.put($scope.osemapi.url+'/boxes/'+boxid, newBoxData, {headers: {'X-ApiKey':$scope.apikey.key}}).
          success(function(data,status){
            $scope.editableMode = !$scope.editableMode;
            $scope.selectedMarker = data;
            if (data.image === "") {
              $scope.image = "placeholder.png";
            } else {
              $scope.image = data.image;
            }
          }).
          error(function(data,status){
            // todo: display an error message
          });
      }

      $scope.discardChanges = function () {
        $scope.editableMode = !$scope.editableMode;
        $scope.selectedMarker = $scope.tmpSensor;
        $scope.image = $scope.tmpSensor.image;
      }

      $scope.deleteBox = function() {
        // to do
      }

      $scope.checkName = function(data) {
        if (data == '') {
          return "";
        }
      };

      //Create our own control for listing
      var listControl = L.control();
      listControl.setPosition('topleft');
      listControl.onAdd = function () {
        var className = 'leaflet-control-my-location',
            container = L.DomUtil.create('div', className + ' leaflet-bar leaflet-control');
        var link = L.DomUtil.create('a', ' ', container);
        link.href = '#';
        L.DomUtil.create('i','fa fa-list fa-lg', link);

        L.DomEvent
          .on(link, 'click', L.DomEvent.preventDefault)
          .on(link, 'click', function(){
            $scope.sidebarActive = true;
            $scope.detailsPanel = false;
            $scope.filterPanel = true;
            $scope.downloadPanel = false;
          });

        return container;
      };

      var geoCoderControl = L.Control.geocoder({
        position: 'topleft',
        placeholder: $filter('translate')('SEARCH_ADDRESS')
      });

      geoCoderControl.markGeocode = function (result) {
        leafletData.getMap().then(function(map) {
          map.fitBounds(result.bbox);
        });
      }

      //adds the controls to our map
      $scope.controls = {
        custom: [ listControl, geoCoderControl ]
      };

      $scope.$watch('sidebarActive', function() {
        if($scope.sidebarActive) {
          // hide controls
        } else {
          // re-enable controls
        }
      });

      $scope.apikey = {};
      $scope.enableEditableMode = function () {
        var boxId = $scope.selectedMarker._id || $scope.selectedMarker.id;

        Validation.checkApiKey(boxId,$scope.apikey.key).then(function(status){
          if (status === 200) {
            $scope.editableMode = !$scope.editableMode;
            $scope.editIsCollapsed = false;
            $scope.tmpSensor = angular.copy($scope.selectedMarker);
          } else {
            $scope.editableMode = false;
          }
        });
      }

      $scope.defaults = {
        tileLayer: "http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg", // Mapquest Open
        tileLayerOptions: {
          subdomains: "1234",
          //attribution in info modal
          detectRetina: true,
          reuseTiles: true
        },
        scrollWheelZoom: true
      };

      $scope.formatTime = function(time) {
        $scope.date = new Date(time);
        $scope.currentTime = new Date();
        $scope.difference = Math.round(($scope.currentTime-$scope.date)/60000);
        return $scope.difference;
      };

      $scope.$on('leafletDirectiveMarker.click', function(e, args) {
        
        // Args will contain the marker name and other relevant information
        //console.log(args);
        $scope.sidebarActive = true;
        $scope.detailsPanel = true;
        $scope.filterPanel = false;
        $scope.downloadPanel = false;
        $scope.selectedMarker = $scope.filteredMarkers[args.markerName]; // see explore.html:160

        if ($scope.selectedMarker.image === undefined || $scope.selectedMarker.image === "") {
          $scope.image = "placeholder.png";
        } else {
          $scope.image = $scope.selectedMarker.image;
        }
        $scope.getMeasurements();
        $scope.center.lat = args.leafletEvent.target._latlng.lat;
        $scope.center.lng = args.leafletEvent.target._latlng.lng;
        $scope.center.zoom = 15;

        $rootScope.selectedBox = $scope.selectedMarker.id;
        $location.path('/explore/'+$scope.selectedMarker.id, false);
      });

      if ($location.path() !== "/launch") {
        OpenSenseBoxes.query(function(response){
          for (var i = 0; i <= response.length - 1; i++) {
            var tempMarker = {};
            tempMarker.phenomenons = []
            tempMarker.lng = response[i].loc[0].geometry.coordinates[0];
            tempMarker.lat = response[i].loc[0].geometry.coordinates[1];
            tempMarker.id = response[i]._id;
            if (_.contains(photonikBoxes, tempMarker.id)) {
              tempMarker.icon = icons.iconG;
            } else {
              tempMarker.icon = icons.iconC;
            }
            tempMarker.name = response[i].name;
            tempMarker.sensors = response[i].sensors;
            tempMarker.image = response[i].image;
            for (var j = response[i].sensors.length - 1; j >= 0; j--) {
              tempMarker.phenomenons.push(response[i].sensors[j].title);

            };
            $scope.markers.push(tempMarker);
          }
          $scope.mapMarkers = $scope.markers;
        });
      }

      $scope.stopit = function() {
        $timeout.cancel($scope.prom);
      };

      $scope.clickcounter = 0;

      $scope.getMeasurements = function() {
        // console.log($scope.selectedMarker);
        var box = $scope.selectedMarker.id || $scope.selectedMarker._id
        $scope.chartConfigs = [];

        //$scope.prom = $timeout($scope.getMeasurements, $scope.delay);
        OpenSenseBoxesSensors.query({boxId:box}, function(response) {
          $scope.selectedMarkerData = response;
        });
      };

      $scope.getData = function(selectedSensor){
        $scope.selectedSensor = selectedSensor;
      	var initDate = new Date();
      	var endDate = '';
        var box = $scope.selectedMarker.id || $scope.selectedMarker._id;
        
        // Get the date of the last taken measurement for the selected sensor
        for (var i = 0; i < $scope.selectedMarker.sensors.length; i++){
        	if ($scope.selectedMarker.sensors[i]._id == selectedSensor._id){
            
            console.log($scope.selectedMarker);
            $scope.chartConfigs[$scope.selectedMarker.sensors[i]._id] = chartConfigDefaults;
            
            if($scope.selectedMarker.sensors[i].lastMeasurement != null) { // means that there is no data for this sensor
              endDate = $scope.selectedMarker.sensors[i].lastMeasurement.createdAt;
            }
            //console.log($scope.selectedMarker);
        		break;
        	}
        }
        
        $scope.lastData.splice(0, $scope.lastData.length);
      	OpenSenseBoxData.query({boxId:box, sensorId: selectedSensor._id, date1: '', date2: endDate})
          .$promise.then(function(response){
            for (var i = 0; i < response.length; i++) {
              var d = new Date(response[i].createdAt);
              $scope.lastData.push([
                Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()),
                parseFloat(response[i].value)
              ]);
            };
            $scope.updateCharts(selectedSensor);
          });
      };
      
      // Update chart data according to the selected sensor(title, yaxis)
      $scope.updateCharts = function(sensor){
      	$scope.chartConfigs[sensor._id].options.title.text = $filter('translate')(sensor.title);
        $scope.chartConfigs[sensor._id].series[0].name = $filter('translate')(sensor.unit);
      	$scope.chartConfigs[sensor._id].options.yAxis.title.text = $filter('translate')(sensor.unit);
        $scope.chartConfigs[sensor._id].loading = false;
      };
     
      // Charts
      $scope.chartConfigs = [];
      var chartConfigDefaults = {
        loading: true,
        options: {
          tooltip: {
            formatter: function(){
              var d = new Date(this.x);
              var htmlstring = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S.', d) +
                '<br><span style="color:'+this.series.color+'">●</span> ' + 
                this.y + ' ' + this.series.name;
              return htmlstring;
            },
            xDateFormat: '%Y-%m-%d %H:%M:%S'
          },
          chart: {
            zoomType: 'x',
            backgroundColor:'rgba(255, 255, 255, 1)'
          },
          title: {
            text: ''
          },
          credits: {
            enabled: false
          },
          xAxis: {
            type: 'datetime'
          },
          yAxis: {
            title: {
              text: ''
            }
          },
          legend: {
            enabled: false
          },
          plotOptions: {
            scatter: {
              animation: false,
              marker: { radius: 2 },
            }
          }
        },
        series: [{
          type: 'scatter',
          name: '',
          pointInterval: 3600 * 24 * 15,
          data: $scope.lastData
        }]
      };

      $scope.dataDownload = function() {
        var from = $filter('date')(new Date($scope.downloadform.dateFrom),'yyyy-MM-dd');
        var to = $filter('date')(new Date($scope.downloadform.dateTo),'yyyy-MM-dd');
        angular.element("body")
          .append('<iframe src="'+$scope.osemapi.url+'/boxes/'+$rootScope.selectedBox+'/data/'+$scope.downloadform.sensorId+'?from-date='+from+'&to-date='+to+'&download=true&format='+$scope.downloadform.format+'" style="display:none"></iframe>')
      }

      $scope.dateOptions = {
        formatYear: 'yy',
        startingDay: 1
      };

      $scope.openDatepicker = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        if($event.currentTarget.id === "datepicker1") {
          $scope.opened1 = true;
          $scope.opened2 = false;
        } else if($event.currentTarget.id === "datepicker2") {
          $scope.opened2 = true;
          $scope.opened1 = false;
        }
        
      };

      /////marc stuff////

      console.log($scope.mapMarkers);
     
        var testJSON = [{
    "name": "Bremer Platz",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "12",
    "createdAt": "2015-04-30T13:22:48.545Z",
    "latitude": 51.95663051646247,
    "longitude": 7.638084768987028
}, {
    "name": "Hurraki",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "24",
    "createdAt": "2015-10-24T10:07:17.975Z",
    "latitude": 47.98904565179757,
    "longitude": 7.82081812614706
}, {
    "name": "mySenseBerlin",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "9.3",
    "createdAt": "2015-12-06T15:53:15.536Z",
    "latitude": 52.586744770634546,
    "longitude": 13.359230607720747
}, {
    "name": "hessetho_1",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "15",
    "createdAt": "2015-04-19T06:59:58.150Z",
    "latitude": 49.68248902032355,
    "longitude": 8.627132177352905
}, {
    "name": "InfoSphere-SenseBox",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "27",
    "createdAt": "2015-03-05T07:16:17.900Z",
    "latitude": 50.78110626861112,
    "longitude": 6.1039188131690025
}, {
    "name": "FabLabMucSenseBox",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "4",
    "createdAt": "2015-02-23T21:05:39.298Z",
    "latitude": 48.137232073694676,
    "longitude": 11.534285824745893
}, {
    "name": "SenseBoxBobingen",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "6.2",
    "createdAt": "2015-10-14T02:19:42.501Z",
    "latitude": 48.27526029852234,
    "longitude": 10.829493820710923
}, {
    "name": "SenseBox Schneefernerhaus - Zugspitze",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "-39.99",
    "createdAt": "2016-01-14T13:17:59.056Z",
    "latitude": 47.41642927123588,
    "longitude": 10.979642048478127
}, {
    "name": "cccamp15 kglbamt",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "24.5",
    "createdAt": "2015-08-16T19:02:05.346Z",
    "latitude": 53.030829534153455,
    "longitude": 13.307422958314419
}, {
    "name": "Baggersee Weingarten",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "17.2",
    "createdAt": "2015-09-20T19:40:02.302Z",
    "latitude": 49.0711669588361,
    "longitude": 8.523674011230469
}, {
    "name": "TrollStation",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "-0.3",
    "createdAt": "2016-01-17T11:21:41.476Z",
    "latitude": 52.02985833597204,
    "longitude": 11.431306600570679
}, {
    "name": "SenseBox Schneefernerkopf - Zugspitze",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "-1.09",
    "createdAt": "2016-01-25T10:08:38.868Z",
    "latitude": 47.411713802829894,
    "longitude": 10.968947410583494
}, {
    "name": "Testbox",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "5",
    "createdAt": "2016-01-25T08:39:20.816Z",
    "latitude": 47.98920402185428,
    "longitude": 7.820871304697903
}, {
    "name": "Rieders Station Arnstadt",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "19.9",
    "createdAt": "2016-01-04T12:19:19.200Z",
    "latitude": 50.83667564893264,
    "longitude": 10.921563506126404
}, {
    "name": "mySenseBerlin",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "8",
    "createdAt": "2016-01-25T10:08:08.493Z",
    "latitude": 52.586751289041494,
    "longitude": 13.359240889549255
}, {
    "name": "mySenseKritzkow",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "23.5",
    "createdAt": "2015-12-27T11:53:11.954Z",
    "latitude": 53.88158363753247,
    "longitude": 12.251547574996948
}, {
    "name": "FabLab Paderborn e.V.",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "25.46",
    "createdAt": "2016-01-14T15:55:21.216Z",
    "latitude": 51.71625446118619,
    "longitude": 8.776633143424988
}, {
    "name": "GroÃŸsedlitz",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "22.77",
    "createdAt": "2016-01-17T10:59:02.867Z",
    "latitude": 50.95689748147324,
    "longitude": 13.888012293346035
}, {
    "name": "WG Wolbecker Str.",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "17.45",
    "createdAt": "2016-01-25T09:52:27.440Z",
    "latitude": 51.957090029248754,
    "longitude": 7.640642523765564
}, {
    "name": "shackspace",
    "exposure": "outdoor",
    "title": "Temperatur",
    "value": "8.16",
    "createdAt": "2016-01-25T10:08:14.946Z",
    "latitude": 48.77702545228982,
    "longitude": 9.236100912094116
}
];
      //var imageBounds = [[46.955917, 5.959302], [54.04408, 14.03326]]; bbox of llSPix (IDW object in R)
      //var imageBounds = [[47.411713802829894, 6.1039188131690025], [53.88158363753247, 13.888012293346035]];
      var imageBounds;
      var overlayImage = null;
      $scope.idp = 1;
      $scope.idpPool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var world;

     
      $scope.makeIDW = function(){

        $scope.loading = true;

        if (overlayImage != null) {
          leafletData.getMap().then(function(map) {
                map.removeLayer(overlayImage);
              });
        };

        var req2 = ocpu.rpc("imageBounds",{
                input : testJSON
            }, function(outtxt){
                imageBounds = [[outtxt[0], outtxt[1]], [outtxt[2], outtxt[3]]];
                console.log(imageBounds);
            });

        var req = ocpu.call("inteRidwIdp", {

            input : testJSON,
            x : $scope.idp

          }, function(session) {

              // $("#key").text(session.getKey());
              // $("#location").text(session.getLoc());
              // $("#fileurl").text(session.getFileURL("idw.png"));

                $scope.loading = false;

                leafletData.getMap().then(function(map) {
                  overlayImage = L.imageOverlay(session.getFileURL("idw.png"), imageBounds);
                  map.addLayer(overlayImage);
                });


              }).fail(function(){
                alert("R returned an error: " + req.responseText); 
              });

      };

      $scope.makeTP = function(){

        $scope.loading = true;

        if (overlayImage != null) {
          leafletData.getMap().then(function(map) {
                map.removeLayer(overlayImage);
              });
        };

        var req2 = ocpu.rpc("imageBounds",{
                input : testJSON
            }, function(outtxt){
                imageBounds = [[outtxt[0], outtxt[1]], [outtxt[2], outtxt[3]]];
                console.log(imageBounds);
            });

        var req = ocpu.call("inteRtp", {

            input : testJSON,

          }, function(session) {

              $scope.loading = false;

              leafletData.getMap().then(function(map) {
                overlayImage = L.imageOverlay(session.getFileURL("idw.png"), imageBounds);
                map.addLayer(overlayImage);
              });


              }).fail(function(){
                alert("R returned an error: " + req.responseText); 
              });

      };

    }]);