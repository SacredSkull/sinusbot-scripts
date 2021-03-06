registerPlugin({
    name: 'Skipper',
    version: '0.3',
    description: 'A good skipper avoids munity by allowing his mates to skip songs!',
    author: 'SacredSkull <me@sacredskull.net>',
    vars: {
        AnnounceVoteStatus: {
            title: "Show vote status in chat (e.g. 2/3 votes, vote successful)",
            type: "select",
            options: ['on','off']
        },
    }
}, function(sinusbot, config) {
    var event = require('event');
    var backend = require('backend');

    var commandRegex = new RegExp(/^!skip(?: \w*?)??$/i);
    var votedUsers = [];
    var neededVotes = 1;

    sinusbot.chatChannel();

    event.on('trackInfo', function(ev) {
        votedUsers = [];
    });

    event.on('chat', function(ev) {
            var match = String(ev.text).match(commandRegex);
            if(match != null){
                if(ev.mode == 2){
                    parseVote(ev.client.id(), !(config.AnnounceVoteStatus == 1));
                } else {
                    var channels = backend.getChannels();
                    var botChannel = null;
                    var userChannel = null;
                    
                    for(var i = 0; i < channels.length; i++){
                        for (var client = 0; client < channels[i].getClients().length; client++) {
                            if(channels[i].getClients()[client].uid() == backend.getBotClient().uid())
                                botChannel = channels[i];
                            if(channels[i].getClients()[client].uid() == ev.client.uid())
                                userChannel = channels[i];
                        }
                    }

                    if(botChannel != null && userChannel != null && botChannel.id() == userChannel.id()){
                        parseVote(ev.client.uid(), true);
                    } else {
                        sinusbot.chatPrivate(ev.client.id(), "You must be in the same channel as the bot to vote.");
                    }
                }
            }
    });
    var initialCount = 1;

    function recalculateVote(count) {
        if(count > 2)
            neededVotes = Math.max(2, Math.ceil(count / 2));
        else
            neededVotes = 1;
    };

    function parseVote(clientUID, sendPrivateMsg) {
        if(votedUsers.indexOf(clientUID) === -1) {
            votedUsers.push(clientUID);
            if(votedUsers.length >= neededVotes) {
                if(config.AnnounceVoteStatus != 1)
                    sinusbot.chatChannel(" -- Vote has passed, skipping... -- ");
                sinusbot.next();
            } else {
                if(config.AnnounceVoteStatus != 1)
                    sinusbot.chatChannel(" -- " + votedUsers.length + "/" + neededVotes + " votes to skip current song -- ");
                if(sendPrivateMsg === true)
                    sinusbot.chatPrivate(clientUID, " -- " + votedUsers.length + "/" + neededVotes + " votes to skip current song -- ");
            }
        } else {
            sinusbot.chatPrivate(clientUID, "You have already voted. The vote is currently at [ " + votedUsers.length + " / " + neededVotes + " ] to skip current song");
        }
    }

    setInterval(function() {
        if('undefined' !== typeof(backend.getCurrentChannel()) 
           && initialCount != backend.getCurrentChannel().getClientCount()) {
            initialCount = backend.getCurrentChannel().getClientCount();
            recalculateVote(initialCount);
        }
    }, 100);
    
});
