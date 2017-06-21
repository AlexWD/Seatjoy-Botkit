var debug = require('debug')('botkit:thread_settings');



module.exports = function(controller) {

    debug('Configuring Facebook thread settings...');
    controller.api.messenger_profile.greeting('Hello! I\'m a Botkit bot!');
    controller.api.messenger_profile.get_started('GetStarted');
//     controller.api.messenger_profile.menu([
//     {
//       "locale":"default",
//       "call_to_actions":[
//         {
//           type: "nested",
//           title: "Real Main Menu",
//           call_to_actions: [
//             {
//               "title":"Main Menu 2",
//               "type":"postback",
//               "payload":"MainMenu"
//            }
//           ]
//         }
        
//       ]
//     }
//   ]);

}
