registerPlugin({
    name: 'Skipper',
    version: '0.1',
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
    var commandRegex = new RegExp(/^!skip(?: \w*?)??$/i);
    var votedUsers = [];
    var neededVotes = 1;

    sinusbot.chatChannel();

    sinusbot.on('trackInfo', function(ev) {
        votedUsers = [];
    });

    sinusbot.on('chat', function(ev) {
            var match = String(ev.msg).match(commandRegex);
            if(match != null){
                if(ev.mode == 2){
                    parseVote(ev.clientUid);
                } else {
                    var channels = sinusbot.getChannels();
                    var botChannel = null;
                    var userChannel = null;

                    for(var i = 0; i < channels.length; i++){
                        for (var client = 0; client < channels[i].clients.length; client++) {
                            if(channels[i].clients[client].id == sinusbot.getBotId())
                                botChannel = channels[i];
                            if(channels[i].clients[client].uid == ev.clientUid)
                                userChannel = channels[i];
                        }
                    }

                    if(botChannel == userChannel && botChannel != null){
                        parseVote(ev.clientUid);
                    } else {
                        sinusbot.chatPrivate(ev.clientId, "You must be in the same channel as the bot to vote.");
                    }
                }
            }
    });

    sinusbot.on('clientCount', function(ev) {
        if(ev.count > 2)
            neededVotes = Math.max(2, Math.ceil(ev.count / 2));
        else
            neededVotes = 1;
    });

    function parseVote(clientUID){
        if(votedUsers.indexOf(clientUID) === -1){
            votedUsers.push(clientUID);
            if(votedUsers.length >= neededVotes){
                if(config.AnnounceVoteStatus != 1)
                    sinusbot.chatChannel(" -- Vote has passed, skipping... -- ");
                sinusbot.next();
            } else {
                if(config.AnnounceVoteStatus != 1)
                    sinusbot.chatChannel(" -- " + votedUsers.length + "/" + neededVotes + " votes to skip current song -- ");
            }
        }
    }
});
