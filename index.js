var apn = require('node-apn');
var inherits = require('util').inherits;

var Service;
var Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
    inherits(PushedNotificationAccessory.CustomNotification, Characteristic);

	homebridge.registerAccessory("homebridge-pushed-notification", "GetPushedNotification", PushedNotificationAccessory);
}

function PushedNotificationAccessory(log, config, api) {
	this.log = log;
	
	this.tokensToSendTo = config['push_token'];
    this.topic = config['push_topic'];

	this.accessoryLabel = config['accessory'];
	this.name = config['name'];
    this.keyId = config['push_key'];
    this.teamId = config['team_id'];
    
	this.notificationSound = config['sound'];
	this.notificationMessage = config['message'];
	this.muteNotificationIntervalInSec = config['mute_notification_interval_in_sec'];
	this.lastSendNotification = "",
	this.log(" sound " + this.notificationSound);
	this.log(" message " + this.notificationMessage);
	this.log(" mute notification interval in sec " + this.muteNotificationIntervalInSec);
	this.log(" storage: " + api.user.storagePath());

	this.serviceMuted = false;
	this.stateValue = false;
  
	var options = {
		token: {
			key: api.user.storagePath() + "/AuthKey_" + this.keyId + ".p8",
			keyId: this.keyId,
			teamId: this.teamId
		},
		production: false
	};

	var apnProvider = new apn.Provider(options);

	let that = this

	this.SendNotification = function(message) {
		this.log('Send notification to GetPushed: ' + message);

		var note = new apn.Notification();

		//note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
		note.badge = 0;
		//note.sound = this.notificationSound;
		// note.sound = "DoorBot.wav";
		note.contentAvailable = 1;
		note.alert = message;
		note.topic = this.topic;
	
		apnProvider.send(note, this.tokensToSendTo).then( (result) => {
			// see documentation for an explanation of result
			that.log('Notification send result is: ' + JSON.stringify(result))
		});
	}
}

PushedNotificationAccessory.CustomNotification = function() {
  Characteristic.call(this, 'Custom Notification', '9056BA41-435E-48DB-B64E-B637A9873ED4');
  
  this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
  });
  
  this.value = "";
};

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
				this.SendNotification(this.notificationMessage);
				
            

				// Mute further notifications for specified time
				this.serviceMuted = true;
				setTimeout(function() {
					
					
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
    setCustomNotification: function (value, callback) {
        this.log('sendValue ' + value);
        if (value.length != 0) {
            this.SendNotification(value);
        }
        this.lastSendNotification = value;
        callback(null);
    },
getCustomNotification: function (callback) {
    callback(this.lastSendNotification, null);
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
        
        this.btnService.addCharacteristic(PushedNotificationAccessory.CustomNotification)
        .on('get', this.getCustomNotification.bind(this))
        .on('set', this.setCustomNotification.bind(this));
		

		return services;
	}
};
