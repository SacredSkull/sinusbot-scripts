registerPlugin({
    name: "Now Playing",
    version: "0.6",
    description: "Sick of users asking what song that is? No longer!",
    author: "SacredSkull <me@sacredskull.net>",
    license: "MIT",
    vars: {
        TitleChannel: {
            title: "Title Channel - Channel/spacer to display the track title.",
            type: "channel"
        },
        ArtistChannel: {
            title: "Artist Channel - Channel/spacer to display the track artist.",
            type: "channel"
        },
        TitleChannelFormat: {
            title: "Title Channel Format - Defaults to a pretty spacer for the track title: '[cspacer0]♫ %trackInfo ♫' becomes '[cspacer0]♫ Symphony No. 5 ♫'.",
            type: "string"
        },
        ArtistChannelFormat: {
            title: "Artist Channel Format - Defaults to a pretty spacer for the track artist: '[cspacer0]🎧 %trackInfo 🎧' becomes '[cspacer0]🎧 Beethoven 🎧'.",
            type: "string"
        },
        NothingPlayingName: {
            title: "Nothing Playing Format - What should the channel be called if nothing is playing?",
            type: "string"
        },
        ttsAnnounce: {
            title: "Announce Cleaned Tracks Over TTS - Note: you must have TTS working in the instance settings - this will not magically make it work.",
            type: "select",
            options: ['on','off']
        },
        channelAnnounce: {
            title: "Announce cleaned up tracks in the current channel chat?",
            type: "select",
            options: ['on','off']
        },
        cleanTTS: {
            title: "Limit allowed characters for TTS - may sound better, may sound worse depending on the TTS. E.g. ft. becomes feat., removes brackets, etc.",
            type: "select",
            options: ['on','off']
        },
        changeNick: {
            title: "Change nickname of the bot to match",
            type: "select",
            options: ['on','off']
        }
    }
}, function(sinusbot, config) {
    var engine = require('engine');
    var backend = require('backend');
    var events = require('event');
    var media = require('media');
    var audio = require('audio');

    var defaultTitleFormat = "[cspacer0]♫ %trackInfo ♫";
    var defaultArtistFormat = "[cspacer0]🎧 %trackInfo 🎧";
    var defaultNothingPlaying = "[cspacer0]♫ Playing nothing :( ♫";

    if('undefined' !== typeof config.NothingPlayingName) {
        config.NothingPlayingName = String(config.NothingPlayingName);
        if(!config.NothingPlayingName.length > 0){
            config.NothingPlayingName = String(defaultNothingPlaying);
        }
    } else {
        config.NothingPlayingName = String(defaultNothingPlaying);
    }

    if('undefined' !== typeof config.TitleChannelFormat) {
        config.TitleChannelFormat = String(config.TitleChannelFormat);
        if(!config.TitleChannelFormat.length > 0){
            config.TitleChannelFormat = String(defaultTitleFormat);
        }
    } else {
        config.TitleChannelFormat = String(defaultTitleFormat);
    }

    if('undefined' !== typeof config.ArtistChannelFormat) {
        config.ArtistChannelFormat = String(config.ArtistChannelFormat);
        if(!config.ArtistChannelFormat.length > 0){
            config.ArtistChannelFormat = String(defaultArtistFormat);
        }
    } else {
        config.ArtistChannelFormat = String(defaultArtistFormat);
    }

    // Currently scrubs up Monstercat, VEVO, Official Video and Lyric debris scattered around the title.
    var bleacher = new RegExp(/(?:[\[|(]{0,1}?Official(?: Music){0,1}(?: Audio){0,1}(?: Video){0,1}(?: HD){0,1}(?: Track)*[\]\)]{0,1})|(?:[\w]*?VEVO)|[\[\(]*?(?:(?:w*?\/[ ]*?)|with )Lyrics[\]\)]*?|[\[\(](?:with[ ]*?|w\/[ ]*?)*?Lyrics[\],\)]|(?:[ ]*?-[ ]*?)*?[\[,\(]{1}(?:(?:[\w,\s]*?Monstercat[\w,\s]*?)|Official(?: Music)*?(?: Video)*?(?: Track)*?|(?:Music Video)*?|OUT NOW|NEW|HD|HQ|DNB|Trap|Breaks|Dubstep|720p|1080p|Drumstep|Hardcore|House|Electro|Electronic|Hard Dance|Glitch[ ]*?Hop|Trance|Indie Dance|Nu Disco|Future Bass)[\]\)]( - )*/gi);
    var implicitArtist = new RegExp(/^([\w ]*\w)([ ]?[-,]?[ ]?)?(?:(').*?(')|.*?)$/gi);

    function CleanTag(tag, scrubber){
        tag = String(tag);
        if('undefined' == typeof tag || tag == null) {
            tag = "Unknown";
        }

        if ('undefined' == typeof scrubber || tag == null) {
            return tag;
        }

        tag = tag.replace(scrubber, "");
        return tag.replace(/(^\s+|\s+$)|(\s\s+)/g, "");
    }

    function ComposeSpacerName(trackInfo, channelFormat, defaultChannelFormat) {
        sinusbot.log("Found " + trackInfo);
        if('undefined' !== typeof trackInfo) {
            trackInfo = String(trackInfo);
            if(!trackInfo.length > 0) {
                trackInfo = "Unknown";
            }
        } else {
            trackInfo = "Unknown";
        }

        var original = String(channelFormat);
        var fullTitle = original.replace(/%trackInfo/gi, trackInfo);

        if(fullTitle.length > 40){
            var minLength = original.replace(/%trackInfo/gi, "").length;
            var availableLength = 40 - minLength;

            trackInfo = trackInfo.substring(0, Math.min(availableLength - 3, trackInfo.length));
            fullTitle = original.replace(/%trackInfo/gi, trackInfo + "...");

            sinusbot.log("Was too long, now truncated to: " + original);
            return fullTitle;
        }

        if(!original.length > 0){
            original = String(defaultChannelFormat);
            original.replace(/%trackInfo/gi, "Unknown");
        }

        return fullTitle;
    }

    events.on('trackEnd', function(ev) {
        if(media.getQueue().length == 0 && !audio.isPlaying()) {
            lastTrackGuard = false;
            if('undefined' !== typeof config.TitleChannel){
                sinusbot.channelUpdate(config.TitleChannel, {
                    "name": config.NothingPlayingName
                });
            }

            if('undefined' !== typeof config.ArtistChannel){
                sinusbot.channelUpdate(config.ArtistChannel, {
                    "name": ComposeSpacerName("-", defaultArtistFormat, defaultArtistFormat)
                });
            }
        }
    });

    var trackRegex = new RegExp(/^(.*?)[ ]?(?:[-,] (.*?)$|(?: ['"])(.*?)['"]$)/i);
    events.on('trackInfo', function(ev) {
        if('undefined' !== typeof config.TitleChannel){
            sinusbot.channelUpdate(config.TitleChannel, {
                "name": "[cspacer0]"
            });
        }
        if('undefined' !== typeof config.ArtistChannel){
            sinusbot.channelUpdate(config.ArtistChannel, {
                "name": "[cspacer0]"
            });
        }

        sinusbot.log("Received new track event for " + ev.title() + " by " + ev.artist());
        var rawTitle = "Unknown";
        var rawArtist = "Unknown";
        var title = "";
        var artist = "";
        var album = "";

        if('undefined' !== typeof ev.tempTitle() && ev.tempTitle().length > 0) {
            title = ev.tempTitle();
            artist = ev.tempArtist();

            title = ComposeSpacerName(ev.tempTitle(), config.TitleChannelFormat, defaultTitleFormat);
            artist = ComposeSpacerName(ev.tempArtist(), config.ArtistChannelFormat, defaultArtistFormat);

            rawArtist = ev.tempArtist();
            rawTitle = ev.tempTitle();
        } else {
            // Cleanup so we can test for the "artist - title" format.
            title = CleanTag(ev.title(), bleacher);
            artist = CleanTag(ev.artist(), bleacher);
            album = CleanTag(ev.album(), bleacher);

            if('undefined' !== typeof title && title.length > 0) {
                rawArtist = String(artist);
                rawTitle = String(title);

                var nestedArtistMatch = title.match(trackRegex);
                if(nestedArtistMatch != null){
                    // Nested artist format detected!
                    if('undefined' !== nestedArtistMatch[2] && nestedArtistMatch[2].length > 0){
                        title = nestedArtistMatch[2];
                        rawTitle = nestedArtistMatch[2];
                    }
                    else if('undefined' !== nestedArtistMatch[3] && nestedArtistMatch[3].length > 0){
                        title = nestedArtistMatch[3];
                        rawTitle = nestedArtistMatch[3];
                    }

                    if('undefined' !== nestedArtistMatch[1] && nestedArtistMatch[1].length > 0){
                        artist = nestedArtistMatch[1];
                        rawArtist = nestedArtistMatch[1];
                    }
                }
            }

            title = ComposeSpacerName(title, config.TitleChannelFormat, defaultTitleFormat);
            if('undefined' !== typeof artist && artist.length > 0 && artist != 'undefined') {
                artist = ComposeSpacerName(artist, config.ArtistChannelFormat, defaultArtistFormat);
            } else {
                if('undefined' !== typeof album) {
                    artist = ComposeSpacerName(album, config.ArtistChannelFormat, defaultArtistFormat);
                    rawArtist = album;
                } else {
                    artist = ComposeSpacerName("Unknown", config.ArtistChannelFormat, defaultArtistFormat);
                    rawArtist = "Unknown";
                }
            }
        }

        if('undefined' !== typeof config.TitleChannel) {
            sinusbot.channelUpdate(config.TitleChannel, {
                "name": title
            });
        }
        if('undefined' !== typeof config.ArtistChannel){
            sinusbot.channelUpdate(config.ArtistChannel, {
                "name": artist
            });
        }

        if(config.changeNick == 0){
            var seperator = " by ";
            var nickTitle = rawTitle;
            var nickArtist = rawArtist;

            var maxLength = 30 - seperator.length;

            if(rawTitle.length + seperator.length > maxLength) {
                // The title alone is too big for the nick, so use it and shorten.
                nickTitle = rawTitle.substring(0, Math.min(maxLength - 3, rawTitle.length));
                nickTitle = nickTitle + "...";

                seperator = "";
                nickArtist = "";
            } else if(rawTitle.length + seperator.length + rawArtist.length > maxLength) {
                if(rawTitle.length > rawArtist.length){
                    nickTitle = rawTitle.substring(0, Math.min(maxLength - rawArtist.length - 3, rawTitle.length));
                    nickTitle = nickTitle + "...";

                    if(rawArtist.length > (maxLength - nickTitle.length)){
                        nickArtist = rawArtist.substring(0, maxLength - nickTitle.length - 3);
                        nickArtist = nickArtist + "...";
                    }
                } else if(rawArtist.length >= rawTitle.length) {
                    nickArtist = rawArtist.substring(0, Math.min(maxLength - rawTitle.length - 3, rawArtist.length));
                    nickArtist = nickArtist + "...";

                    if(rawTitle.length > (maxLength - nickArtist.length)){
                        nickTitle = rawTitle.substring(0, maxLength - nickArtist.length - 3);
                        nickTitle = nickTitle + "...";
                    }
                }
            }
            sinusbot.setNick(nickTitle + seperator + nickArtist);
        }

        var fullyCleaned = rawTitle + ", by " + rawArtist;

        // Announce over TTS if desired
        if(config.ttsAnnounce == 0){
            // Clean up names for TTS.
            var ttsFriendly = new RegExp(/[^\w\s]/gi);
            if(config.cleanTTS == 0)
                sinusbot.say(fullyCleaned.replace(ttsFriendly, "").replace(/ft[.]*?/gi, 'feat'));
            else
                sinusbot.say(fullyCleaned);
        }

        if(config.channelAnnounce == 0){
            sinusbot.chatChannel(fullyCleaned);
        }

    });
});
