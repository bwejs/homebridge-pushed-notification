var apn = require('node-apn');

var Service;
var Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-pushed-notification", "GetPushedNotification", PushedNotificationAccessory);
}

function PushedNotificationAccessory(log, config, api) {
	this.log = log;
	
	this.tokensToSendTo = [
							"e862580646e2b3be74befc35580341727a3935c5a3ab9b9e2dd41b35754be058", // Arye's iPhone 13 mini
							"47312ac14a43a69470cd8912371f70b9d96bb94af3d6ea55948093cb51ed108b", // Tehila's iPhone 12 mini
							"a621a44c7afe11ae2c27569fc5213292d27dbe8b95944b9c519ad1422abca901", // Home's iPad Pro 12.9 1st Gen (Kitchen)
							"ae5ac8d8e850049180f830282fd2268b69fba183ab7cf24848b87f4c09f521b1", // Home's Music iPad (Living room)
							"f88e03e7eaf84b43f6a1c471a45f582bb0711accdefd5de8c7e389b2b43d5b5e", // Home's iPad Pro 12.9 2nd Gen (Entrance)
							"7b80590f7407fef532f9091351ec81d65c973a50f089179811a1e84a031d9ca0", // Home's iPad mini 5th Gen (Bedroom)
							"f45c0482f75863c6a807e5116466b4bcb8984608b90312bf9d178051ff595d14"  // Arye's iPad mini 6th Gen
						];
	this.accessoryLabel = config['accessory'];
	this.name = config['name'];

	this.notificationSound = config['sound'];
	this.notificationMessage = config['message'];
	this.muteNotificationIntervalInSec = config['mute_notification_interval_in_sec'];
	
	this.useMotionDetectorAccessory = config['use_motion_sensor'];

	this.log(" sound " + this.notificationSound);
	this.log(" message " + this.notificationMessage);
	this.log(" mute notification interval in sec " + this.muteNotificationIntervalInSec);
	this.log(" storage: " + api.user.storagePath());

	this.serviceMuted = false;
	this.stateValue = false;
  
	var options = {
		token: {
			key: __dirname + "/AuthKey_V7N96X5446.p8",
			keyId: "V7N96X5446",
			teamId: "TQ4Y7TT2V3"
		},
		production: false
	};

	var apnProvider = new apn.Provider(options);

	let that = this

	this.SendNotification = function() {
		this.log('Send notification to GetPushed: ' + this.notificationMessage);

		var note = new apn.Notification();

		note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
		note.badge = 0;
		note.sound = this.notificationSound;
		// note.sound = "DoorBot.wav";
		note.contentAvailable = 1;
		note.alert = "\uD83D\uDCE7 \u2709 You have a new message";
		note.topic = "com.supersmarket.Ring-Sound-Player";
	
		apnProvider.send(note, this.tokensToSendTo).then( (result) => {
			// see documentation for an explanation of result
			that.log('Notification send result is: ' + JSON.stringify(result))
		});
	}
}


PushedNotificationAccessory.prototype = {
	getValue: function(callback) {
		var that = this;
		callback(null, false);
	},
	setValue: function (value, callback) {
		this.log('setState ' + value);
		this.stateValue = value;

		if (this.stateValue === true) {
			// 'that' is used inside timeout functions
			var that = this;

			// Clear the On value after 250 milliseconds 
			setTimeout(function() {
				that.stateValue = false;
				that.btnService.setCharacteristic(Characteristic.On, false)
			}, 500 );

			// Send GetPushed notification
			if (this.serviceMuted === false) {
				this.SendNotification();
				
				if (this.useMotionDetectorAccessory) {
					this.mtnService.getCharacteristic(Characteristic.MotionDetected).setValue(1);
				}

				// Mute further notifications for specified time
				this.serviceMuted = true;
				setTimeout(function() {
					if (that.useMotionDetectorAccessory) {
						that.mtnService.getCharacteristic(Characteristic.MotionDetected).setValue(0);
					}
					
					that.serviceMuted = false;
					that.log("GetPushed un-muted");
				}, this.muteNotificationIntervalInSec * 1000);
			}
			else {
				this.log("GetPushed notification is muted");
			}
		}
		callback(null);
	},
	identify: function (callback) {
		this.log("Identify requested!");
		callback();
	},
	getServices: function () {
		var services = [];
		var infoService = new Service.AccessoryInformation();
		infoService
		.setCharacteristic(Characteristic.Manufacturer, "Acc-UA")
		.setCharacteristic(Characteristic.Model, "GetPushedNotificationButton")
		.setCharacteristic(Characteristic.SerialNumber, "GetPushedNotificationButton2017");
		services.push(infoService);

		this.btnService = new Service.Switch(this.name);
		this.btnService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getValue.bind(this))
		.on('set', this.setValue.bind(this));
		services.push(this.btnService);
		
		if (this.useMotionDetectorAccessory) {
			this.mtnService = new Service.MotionSensor(this.name);
			services.push(this.mtnService);
		}

		return services;
	}
};
