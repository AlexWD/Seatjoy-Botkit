/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Facebook bot built with Botkit.

# RUN THE BOT:
  Follow the instructions here to set up your Facebook app and page:
    -> https://developers.facebook.com/docs/messenger-platform/implementation
  Run your bot from the command line:
    page_token=<MY PAGE TOKEN> verify_token=<MY_VERIFY_TOKEN> node bot.js



~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
var env = require('node-env-file');
var fs = require('fs');
var request = require('request');

// development
if (fs.existsSync(__dirname + '/.env')) {
  env(__dirname + '/.env');
}



if (!process.env.page_token) {
    console.log('Error: Specify a Facebook page_token in environment.');
    usage_tip();
    process.exit(1);
}

if (!process.env.verify_token) {
    console.log('Error: Specify a Facebook verify_token in environment.');
    usage_tip();
    process.exit(1);
}

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

let botConfigs = [
  {
    page_token: 'EAADHHcEoYFYBAF6qwrikbTB3t7pGQYuX06KAZB3QBoQqpZAnADJE4nVeibu5dL8Vt2cbK5jg3M3c6qYyOpw5MGtHXswIsvqqQ4gH9EnZCdaWj5pyfK10b2kCVv7ToUsKkkFLTmPzf7sHFK58KizZBQnNGG7FI3giZAhWthgAxrwZDZD',
    page_id: '107561546480668',
    verify_token: 'a_verify_token',
    square_merchant_id: 'A4RYS03VV89MM',
    square_access_token: 'sq0atp-VXfeO1EL-6IQrKz7hEJmVw',
    id: 'kokio'
  },
  {
    page_token: 'EAAYAZAwbsSzMBAMuYwIzq9aIJSOu0NPby3CjyZBBLGLxvaffnHOgEbnTK9rYINAESVAHZA00GZBnSH3f72T414jCryHrkokwfj2NAZAYX4yrH1NYM3tkWEHkx40pGwfV8Lfcqc8FmRviXHfmTXh7dts2anItbyA0RHU5CYl2yjQZDZD',
    page_id: '732727266909954',
    verify_token: 'a_verify_token',
    square_merchant_id: '19K4BY3C9DR55',
    square_access_token: 'sq0atp-vmPijA4wPGN9mwF-dKjZ-A',
    id: 'beyondtheborder'
  }
];

let controllers = {};

botConfigs.forEach(botConfig => {
  // Create the Botkit controller, which controls all instances of the bot.
  var controller = Botkit.facebookbot({
      debug: true,
      receive_via_postback: true,
      verify_token: botConfig.verify_token,
      access_token: botConfig.page_token,
      studio_token: botConfig.studio_token,
      studio_command_uri: botConfig.studio_command_uri,
      botConfig: botConfig
  });

  controllers[botConfig.id] = controller;

  // Load POS API data for the bot
  loadBotDetails(controller);
});


function loadBotDetails(controller) {
  let botConfig = controller.config.botConfig;
  request({
    url: `https://connect.squareup.com/v1/${botConfig.square_merchant_id}/items`,
    headers: {
      "Authorization": `Bearer ${botConfig.square_access_token}`
    }
  }, (error, response, body) => {
    if (error) {
      console.log(error);
    } else {
      let items = JSON.parse(body);
      let menuItems = [];
      items.map(item => {
        let cat = item.category ? item.category.name : 'other';

        if (!Array.isArray(menuItems[cat])) {
          menuItems[cat] = [];
        }

        let variations = item.variations.length < 2 ? [] : item.variations.map(variation => {
          return {
            name: variation.name,
            price: variation.price_money ? variation.price_money.amount / 100 : 0
          };
        });

        menuItems[cat][item.id] = {
          id: item.id,
          name: item.name,
          title: '',
          description: item.description,
          image: item.master_image ? item.master_image.url : '',
          price: item.variations[0].price_money ? item.variations[0].price_money.amount / 100 : 0,
          taxes: 0,
          options: variations
        };
      });

      controller.config.botConfig.menuItems = menuItems;

    }
  });
}

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controllers);

Object.keys(controllers).forEach(botid => {
  let controller = controllers[botid];

  // Tell Facebook to start sending events to this application
  require(__dirname + '/components/subscribe_events.js')(controller);

  // Set up Facebook "thread settings" such as get started button, persistent menu
  require(__dirname + '/components/thread_settings.js')(controller);


  // Send an onboarding message when a user activates the bot
  require(__dirname + '/components/onboarding.js')(controller);

  // Enable Dashbot.io plugin
  require(__dirname + '/components/plugin_dashbot.js')(controller);

  var normalizedPath = require("path").join(__dirname, "skills");
  require("fs").readdirSync(normalizedPath).forEach(function(file) {
    let skill = require("./skills/" + file);

    let skillInst = new skill(controller);
    //require("./skills/" + file)(controller);
  });
})




// This captures and evaluates any message sent to the bot as a DM
// or sent to the bot in the form "@bot message" and passes it to
// Botkit Studio to evaluate for trigger words and patterns.
// If a trigger is matched, the conversation will automatically fire!
// You can tie into the execution of the script using the functions
// controller.studio.before, controller.studio.after and controller.studio.validate
if (process.env.studio_token) {
    // controller.on('message_received', function(bot, message) {
    //     if (message.text) {
    //         controller.studio.runTrigger(bot, message.text, message.user, message.channel).then(function(convo) {
    //             if (!convo) {
    //                 // no trigger was matched
    //                 // If you want your bot to respond to every message,
    //                 // define a 'fallback' script in Botkit Studio
    //                 // and uncomment the line below.
    //                 controller.studio.run(bot, 'fallback', message.user, message.channel);
    //             } else {
    //                 // set variables here that are needed for EVERY script
    //                 // use controller.studio.before('script') to set variables specific to a script
    //                 convo.setVar('current_time', new Date());
    //             }
    //         }).catch(function(err) {
    //             if (err) {
    //                 bot.reply(message, 'I experienced an error with a request to Botkit Studio: ' + err);
    //                 debug('Botkit Studio: ', err);
    //             }
    //         });
    //     }
    // });
} else {
    console.log('~~~~~~~~~~');
    console.log('NOTE: Botkit Studio functionality has not been enabled');
    console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
}

function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Botkit Studio Starter Kit');
    console.log('Execute your bot application like this:');
    console.log('page_token=<MY PAGE TOKEN> verify_token=<MY VERIFY TOKEN> studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js');
    console.log('Get Facebook token here: https://developers.facebook.com/docs/messenger-platform/implementation')
    console.log('Get a Botkit Studio token here: https://studio.botkit.ai/')
    console.log('~~~~~~~~~~');
}
