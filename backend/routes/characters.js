var express = require('express');
var router = express.Router();
var neCache = require('../services/mongo-cache.js');
var WoWGuild = require('../services/wow-guild.js');
var WoWCharacter = require('../services/wow-character.js');
var _ = require('lodash');

router.get('/', function(req, res, next){
    neCache.getAllCharacters(function(characters) {
        var charactersData = [];
        _.each(characters, function(character) {
            if(character && character.character.level >= 10) {
                charactersData.push(buildCharacterData(character));
            }
        });
        charactersData =_.sortByOrder(charactersData, ['rankId', 'name'], ['asc', 'asc']);
        res.send({characters: charactersData});
    });
});
// 1-2-3-4
router.get('/update', function(req, res, next){
    WoWGuild.members(function(data) {
        var characters = data.members;
        console.log(characters.length + ' characters found');

        var charactersData = [];
        if(characters.length > 0) {
            neCache.dropCharacters();

            _.each(characters, function (character) {
                neCache.saveCharacter(character);

                if(character && character.character.level >= 10) {
                    charactersData.push(buildCharacterData(character));
                }
            });
        } else {
            neCache.getAllCharacters(function(characters) {
                _.each(characters, function(character) {
                    if(character && character.character.level >= 10) {
                        charactersData.push(buildCharacterData(character));
                    }
                });
            });
        }

        charactersData =_.sortByOrder(charactersData, ['rankId', 'name'], ['asc', 'asc']);
        res.send({characters: charactersData});
    });
});

var buildCharacterData = function(character) {
    return {
        name: character.character.name,
        iconUrl: WoWCharacter.portrait(character.character.thumbnail),
        color: {"color": WoWCharacter.color(character.character.class)},
        rankId: character.rank,
        rank: WoWGuild.rank(character.rank),
        isRoster: WoWGuild.isPartOfRoster(character.rank) ? 1 : 0
    };
};

module.exports = router;