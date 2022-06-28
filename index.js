var apn = require('@parse/node-apn');
var inherits = require('util').inherits;
const fs = require('fs');

var Service;
var Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    inherits(CustomNotification, Characteristic);
    inherits(ResetInterval, Characteristic);
    inherits(DefaultInterval, Characteristic);
    inherits(NotificationService, Service);
    inherits(CountdownValue, Characteristic);
    inherits(StartWithDefaultInterval, Characteristic);

    homebridge.registerAccessory("homebridge-pushed-notification", "GetPushedNotification", PushedNotificationAccessory);
}
class PushedNotificationAccessory {
    constructor(...props) {
        [this.log, this.config, this.api] = [...props];
        var config = this.config;
        this.tokensToSendTo = this.config['push_token'];
        this.topic = config['push_topic'];
        this.storage = config['storage'];
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
        this.isAnyOn = false;
        this.lastNumberActive = 0;
        this.resetInterval = 120;
        this.defaultInterval = 600;
        
        if (this.storage != null) {
            try {
                
                let rawdata = fs.readFileSync(this.storage);
                let jsonContent = JSON.parse(rawdata);
                let def = jsonContent.defaultInterval
                this.log("defaultInterval:", def);
                if (def != undefined) {
                    this.defaultInterval = def;
                }
                let reset = jsonContent.resetInterval
                this.log("resetInterval:", reset);
                if (reset != undefined) {
                    this.resetInterval = reset;
                }
            } catch(err) {
                this.log(err);
              }
        }

        this.SendNotification = function(message, expire) {
            this.log('Send notification to GetPushed: ' + message);
            
            var note = new apn.Notification();
            if (expire > 0) {
                note.expiry = Math.floor(Date.now() / 1000) + expire;
            }
            note.badge = that.numberOfActives();
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
        this.ClearNotification = function (newNumberActive) {
            this.log('clear notification to GetPushed: ');
            
            var note = new apn.Notification();
          
            note.badge = newNumberActive;
            //note.sound = this.notificationSound;
            // note.sound = "DoorBot.wav";
            note.contentAvailable = 1;
//            note.alert = message;
//            note.payload = { 'aps': {'interruption-level': 'time-sensitive', 'badge' : 7 }};
            note.topic = topic;
            
            apnProvider.send(note, token).then( (result) => {
                // see documentation for an explanation of result
                that.log('Notification send result is: for clear. ' + JSON.stringify(result))
            });
        }
        this.numberOfActives = function () {
            var number = 0;
            var arrayLength = that.wrappers.length;
            for (var i = 0; i < arrayLength; i++) {
                
                if (that.wrappers[i].cValue > 0) {
                    number++;
                }
            }
            return number
        }
    }
    
    
    persistData() {
        if (this.storage != null) {
            try {
                let json = {
                    defaultInterval: this.defaultInterval,
                    resetInterval: this.resetInterval
                };
                 
                let data = JSON.stringify(json);
                fs.writeFileSync(this.storage, data);
            } catch(err) {
                this.log(err);
              }
        }
    }
    
    
    checkAnyOn() {
        var oldValue = this.isAnyOn;

       // this.log("Start Check Any On. " + this.name);
       /// this.log("Start Check Any On. " + this.wrappers);
        var isOn = false;
        
        var arrayLength = this.wrappers.length;
        for (var i = 0; i < arrayLength; i++) {
            
            if (this.wrappers[i].cValue > 0) {
                isOn = true;
            }
            //this.log("Checking.");
            //Do something
        }
        
        var newValue = !!isOn;
        this.isAnyOn = newValue;
        
        if(!newValue && oldValue) {
            //that.ClearNotification()
        }
        var newNumberActive = this.numberOfActives()
        if(this.lastNumberActive != newNumberActive) {
            this.log("Update Value for Active elements to " + newNumberActive);
            this.ClearNotification(newNumberActive);
        }
        this.lastNumberActive = newNumberActive;
        this.contactService.getCharacteristic(Characteristic.ContactSensorState).updateValue(newValue);
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
                                        var wrapper = new NotificationHandler(channel['name'], this.log, channel['defaultMessage'], this);
                                        this.services.push(wrapper.getService());
                                        this.wrappers.push(wrapper);
        }
        );
        const name = "Any On";
        const subtype = name;
        this.contactService = new Service.ContactSensor(name, subtype);
        
        this.resetIntervalChar = this.contactService.addCharacteristic(ResetInterval)
               .on('get', this.getResetIntervalValue.bind(this))
               .on('set', this.setResetIntervalValue.bind(this))
        .setProps({maxValue: 7200});
        
        
        this.defaultIntervalChar = this.contactService.addCharacteristic(DefaultInterval)
               .on('get', this.getDefaultIntervalValue.bind(this))
               .on('set', this.setDefaultIntervalValue.bind(this))
        .setProps({maxValue: 7200});
        
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
    
    setResetIntervalValue(newValue, callback) {
        this.resetInterval = Math.round(newValue);
        this.persistData();
        callback();
    }
    
    getResetIntervalValue(callback) {
        callback(null, this.resetInterval);
    }
    setDefaultIntervalValue(newValue, callback) {
        this.defaultInterval = Math.round(newValue);
        this.persistData();
        callback();
    }
    
    getDefaultIntervalValue(callback) {
        callback(null, this.defaultInterval);
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

ResetInterval = function() {
    Characteristic.call(this, 'ResetInterval', 'EB064F24-CA1D-4FC3-8B63-3905089862AC');
    
    this.setProps({
      format: Characteristic.Formats.UINT16,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
      unit : Characteristic.Units.SECONDS,
    });
    
    this.value = "";
};

StartWithDefaultInterval = function() {
    Characteristic.call(this, 'Start', 'EB064F24-CA1D-4FC3-8B63-3905089862BB');
    
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
    });
    
    this.value = false;
};

DefaultInterval = function() {
    Characteristic.call(this, 'DefaultInterval', '59F9A53E-352D-468F-ABFB-60E96AAC1CAC');
    
    this.setProps({
      format: Characteristic.Formats.UINT16,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE],
      unit : Characteristic.Units.SECONDS,
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
    constructor(name, log, message,accessory) {
        this.message = message;
        this.name = name;
        this.accessory = accessory
        this.log = log
        this.stateValue = false;
        this.cValue = 0;
        this.log("Init with name " + message);
        this.DefaultInterval = 600;
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
        .setProps({maxValue: 7200});
        
        
        this.start = this.service.addCharacteristic(StartWithDefaultInterval)
               .on('get', this.getStartWithDefaultInterval.bind(this))
                .on('set', this.setStartWithDefaultInterval.bind(this))

        
        return this.service;
    }
    setTimer() {
      this.accessory.checkAnyOn(this.accessory);
      clearTimeout(this.timer);
      if (this.cValue == 0) {
          this.log.info("Send Value timeout at 0");
          this.accessory.SendNotification(this.message, this.accessory.resetInterval);
          if (this.accessory.resetInterval > 0) {
              this.cValue = this.accessory.resetInterval;
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
          if (this.value < 15) {
              this.log(this.name + ' Counting down. ' + this.cValue);
          } else if ((this.value % 15) == 0) {
              this.log(this.name + ' Counting down. ' + this.cValue);
          }
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
        this.accessory.checkAnyOn(this.accessory);
        callback();
    }

    getCountDownValue(callback) {
        callback(null, this.cValue);
    }
    
    
    getStartWithDefaultInterval(callback) {
        callback(null, false);
    }
    setStartWithDefaultInterval(newValue, callback) {
        if (!!newValue) {
            this.setCountDownValue(this.accessory.defaultInterval, callback);
        } else {
            callback();
        }
        var that = this;
        setTimeout(function() {
            that.service.setCharacteristic(StartWithDefaultInterval, false)
        }, 500 );
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
            
            this.accessory.SendNotification(this.message, 0);
            callback(null);

        } else {
            callback(null);

        }
         
    }
}


