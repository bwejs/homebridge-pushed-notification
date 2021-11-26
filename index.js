var apn = require('@parse/node-apn');
var inherits = require('util').inherits;

var Service;
var Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    inherits(CustomNotification, Characteristic);
    inherits(NotificationService, Service);
    inherits(CountdownValue, Characteristic);

    homebridge.registerAccessory("homebridge-pushed-notification", "GetPushedNotification", PushedNotificationAccessory);
}
class PushedNotificationAccessory {
    constructor(...props) {
        [this.log, this.config, this.api] = [...props];
        var config = this.config;
        this.tokensToSendTo = this.config['push_token'];
        this.topic = config['push_topic'];
        
        this.accessoryLabel = this.config['accessory'];
        this.name = config['name'];
        this.keyId = config['push_key'];
        this.teamId = config['team_id'];
        
        this.notificationSound = this.config['sound'];
        this.notificationMessage = this.config['message'];
        this.muteNotificationIntervalInSec = config['mute_notification_interval_in_sec'];
        this.lastSendNotification = "",
        this.log(" sound " + this.notificationSound);
        this.log(" message " + this.notificationMessage);
        this.log(" mute notification interval in sec " + this.muteNotificationIntervalInSec);
        this.log(" storage: " + this.api.user.storagePath());
        
        this.serviceMuted = false;
        this.stateValue = false;
        
        var options = {
        token: {
        key: this.api.user.storagePath() + "/AuthKey_" + this.keyId + ".p8",
        keyId: this.keyId,
        teamId: this.teamId
        },
        production: false
        };
        
        var apnProvider = new apn.Provider(options);
        
        let that = this;
        let token = this.tokensToSendTo;
        let topic = this.topic;
        this.wrappers = [];

        this.SendNotification = function(message, expire) {
            this.log('Send notification to GetPushed: ' + message);
            
            var note = new apn.Notification();
            if (expire > 0) {
                note.expiry = Math.floor(Date.now() / 1000) + expire; // Expires 1 hour from now.
            }
            note.badge = 0;
            //note.sound = this.notificationSound;
            // note.sound = "DoorBot.wav";
            note.contentAvailable = 1;
            note.alert = message;
            //note.payload = { 'aps': {'interruption-level': 'time-sensitive', 'badge' : 7 }};
            note.topic = topic;
            
            apnProvider.send(note, token).then( (result) => {
                // see documentation for an explanation of result
                that.log('Notification send result is: ' + JSON.stringify(result))
            });
        }
    }
    checkAnyOn(that) {
        that.log("Start Check Any On. " + that.name);
        that.log("Start Check Any On. " + that.wrappers);
        var isOn = false;
        
        var arrayLength = that.wrappers.length;
        for (var i = 0; i < arrayLength; i++) {
            
            if (that.wrappers[i].cValue > 0) {
                isOn = true;
            }
            that.log("Checking.");
            //Do something
        }
        
        
//
//        this.wrappers.forEach( wrapper =>
//            {
//
//
//        })
        that.contactService.getCharacteristic(Characteristic.ContactSensorState).updateValue(!!isOn);
    }
   
    getServices() {
        this.services = [];

        var infoService = new Service.AccessoryInformation();
        infoService
        .setCharacteristic(Characteristic.Manufacturer, "Acc-UA")
        .setCharacteristic(Characteristic.Model, "GetPushedNotificationButton")
        .setCharacteristic(Characteristic.SerialNumber, "GetPushedNotificationButton2017");
        this.services.push(infoService);
        
        this.config['channels'].forEach( channel =>
                                        {
                                        var wrapper = new NotificationHandler(channel['name'], this.SendNotification, this.log, channel['defaultMessage'], this.checkAnyOn, this);
                                        this.services.push(wrapper.getService());
                                        this.wrappers.push(wrapper);
        }
        );
        const name = "Any On";
        const subtype = name;
             this.contactService = new Service.ContactSensor(name, subtype);
        // create a new Contact Sensor service
      //    this.contactService = new Service(Service.ContactSensor);
        this.services.push(this.contactService);

        /*  // create handlers for required characteristics
          this.contactService.getCharacteristic(Characteristic.ContactSensorState)
            .onGet(this.handleContactSensorStateGet.bind(this));
         */
        
        this.checkAnyOn(this);
        return this.services;
    }
    identify(callback) {
        this.log("Identify requested!");
        callback();
    }
    getCustomNotification(callback) {
        callback(this.lastSendNotification, null);
    }
    setCustomNotification(value, callback) {
        this.log('sendValue ' + value);
        if (value.length != 0) {
            this.SendNotification(value, 0);
        }
        this.lastSendNotification = value;
        callback(null);
    }
}

NotificationService = function(name) {
var uuid = '8B16C89F-D79B-43D7-9A6A-6BE66D036165';

  Service.call(this, name, uuid, name);
  this.UUID = uuid;
};

CustomNotification = function() {
    Characteristic.call(this, 'Custom Notification', '9056BA41-435E-48DB-B64E-B637A9873ED4');
    
    this.setProps({
    format: Characteristic.Formats.STRING,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    
    this.value = "";
};



CountdownValue = function(max) {
  Characteristic.call(this, 'CountdownValue', '1EAED9FE-B3C6-45E4-9899-7C71EAA15122');
  this.setProps({
    format: Characteristic.Formats.UINT16,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
    unit : Characteristic.Units.SECONDS,
  });
  this.value = 0;
};

class NotificationHandler {
    constructor(name, sendFunction, log, message, checkAnyOn, that) {
        this.message = message;
        this.name = name;
        this.sendFunction = sendFunction
        this.log = log
        this.stateValue = false;
        this.cValue = 0;
        this.log("Init with name " + message);
        this.resetInterval = 120;
        this.checkAnyOn = checkAnyOn;
        this.that = that;
    }
    
    getService() {
        this.log("Initting with name " + this.message);
        this.service = new NotificationService(this.name);
        this.service
        .addCharacteristic(Characteristic.On)
        .on('get', this.getValue.bind(this))
        .on('set', this.setValue.bind(this));
        
//        this.btnService.addCharacteristic(CustomNotification)
//        .on('get', this.getCustomNotification.bind(this))
//        .on('set', this.setCustomNotification.bind(this));
        
        
        this.contdownCharacteristic = this.service.addCharacteristic(CountdownValue)
               .on('get', this.getCountDownValue.bind(this))
               .on('set', this.setCountDownValue.bind(this))
        .setProps({maxValue: 3600});
        
        
        return this.service;
    }
    setTimer() {
      this.checkAnyOn(this.that);
      clearTimeout(this.timer);
      if (this.cValue == 0) {
          this.log.info("Send Value timeout at 0");
          this.sendFunction(this.message, this.resetInterval);
          if (this.resetInterval > 0) {
              this.cValue = this.resetInterval;
              this.contdownCharacteristic.updateValue(this.cValue);
          }
      }
      if (this.cValue <= 0) {
        return;
      }
      this.timer = setTimeout(function() {
        this.cValue--;
          if (this.cValue < 0) {
              this.cValue = 0;
          }
        this.log(this.name + ' Counting down. ' + this.cValue);
        this.contdownCharacteristic.updateValue(this.cValue);
        this.setTimer()
      }.bind(this), 1000);
    }
    
    setCountDownValue(newValue, callback) {
        this.cValue = Math.round(newValue);
        this.log("Value was set to " + this.cValue + ". Will now set timer");
        if (this.cValue != 0) {
            this.setTimer()
        } else {
            clearTimeout(this.timer);
        }
        this.checkAnyOn(this.that);
        callback();
    }

    getCountDownValue(callback) {
        callback(null, this.cValue);
    }
    
    
    
    getValue(callback) {
        callback(null, this.stateValue);
    }
    setValue(value, callback) {
        this.log('setState ' + value);
        this.stateValue = value;
        
        if (this.stateValue === true) {
            // 'that' is used inside timeout functions
            var that = this;
            
            // Clear the On value after 250 milliseconds
            setTimeout(function() {
                that.stateValue = false;
                that.service.setCharacteristic(Characteristic.On, false)
            }, 500 );
            
            this.sendFunction(this.message, 0);
            callback(null);

        } else {
            callback(null);

        }
         
    }
}


