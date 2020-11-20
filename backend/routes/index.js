var express = require('express');
var _ = require('lodash');
var moment = require('moment');
moment.locale('fr');
var WoW = require('../services/wow.js');
var WoWCharacter = require('../services/wow-character.js');
var WoWInventory = require('../services/wow-inventory.js');
var WoWItem = require('../services/wow-item.js');
var Parameters = require('../../parameters.js');
var router = express.Router();
var Slack = require('node-slackr');
var slack = new Slack(Parameters.Slack.hook,{
	username: "wow-bot"
});
var neCache = require ("../services/mongo-cache.js");
// je suis un test
var buildNewsMessage = function(item, callback){
	if(item.type === 'itemLoot'){
		WoW.itemInfos(item, item.context, true, function(itemData, sure){
			if(!itemData.itemLevel){
				return;
			}

			var fields;
            if(itemData.nameDescription) {
                fields = [
                    {
                        title: itemData.nameDescription,
                        value: '',
                        short:false
                    },
                    {
                        title: sure ? 'Item level': 'Item level (incertain)',
                        value: itemData.itemLevel.toString(),
                        short:true
                    }
                ];
            } else {
                fields = [
                    {
                        title: sure ? 'Item level': 'Item level (incertain)',
                        value: itemData.itemLevel.toString(),
                        short:true
                    }
                ];
			}

			if(!itemData.name || itemData.itemLevel < Parameters.WoW.minIlvl){
				return;
			}

			if(itemData.inventoryType){
				var fullType = WoWInventory.inventoryTypes[''+itemData.inventoryType];
				if(fullType){
					fields.push({title:"Emplacement",value:fullType,short:true});
				}
			} else if(itemData.gemInfo) {
                var type = WoWInventory.inventoryTypes['28'];
                var relicType = WoWInventory.relicTypes[itemData.gemInfo.type.type];
                if(type){
                    fields.push({title:"Emplacement", value:type+' ('+relicType+')', short:true});
                }
			}

			var primaries = WoWItem.PrimariesCaracs(itemData);
			if(primaries && primaries.length > 0){
				fields.push({title: "Primaires", value:WoWItem.toString(primaries), short:true});
			}

			var secondaries = WoWItem.SecondariesCaracs(itemData);
			if(secondaries && secondaries.length > 0){
				fields.push({title: "Secondaires", value:WoWItem.toString(secondaries), short:true});
			}

            var bonus = WoWItem.getBonus(itemData);
            if(bonus && bonus.length > 0){
                fields.push({title: "Bonus", value:WoWItem.toString(bonus), short:true});
            }

            var effect = WoWItem.getEffect(itemData);
            if(effect) {
                fields.push({title: "Effet", value:effect, short:false});
			}

			var wowheadLink = 'http://fr.wowhead.com/item='+item.itemId;
			if(item.bonusLists && item.bonusLists.length > 0) {
				wowheadLink += "&bonus=";
				_.each(item.bonusLists, function (bonus, index) {
					wowheadLink += (index == 0) ? bonus : ":" + bonus;
				});
			}
			WoWCharacter.baseInfo(item.character, function(characterData){
				var message = {
					channel: '#loot',
					attachments:[
						{
							fallback:item.character + ' a loot ' + itemData.name + ' (iLvL '+itemData.itemLevel+')',
							pretext:item.character,
							title:itemData.name,
							title_link: wowheadLink,
							thumb_url: WoW.itemIconUrl(itemData.icon),
							color: WoW.itemColor(itemData.quality),
							fields:fields
						}
					]
				};
				if(characterData){
					message.icon_url = WoWCharacter.portrait(characterData.thumbnail)
				}
				callback(message);
			});
		});
	}
};

var buildNewsMessageLight = function(item, callback){
	if(item.type === 'itemLoot'){
		WoW.itemInfos(item, item.context, true, function(itemData, sure){
			var text = item.character + ' a loot '+itemData.name + ' (iLvl ' + itemData.itemLevel;
			if (!sure){
				text += ', incertain';
			}
			text += ') le ' + moment(item.timestamp, 'x').format('dddd DD MMMM');
			callback({
				text: text,
				channel: '#loot',
				icon_url: WoW.itemIconUrl(itemData.icon)
			});
		});
	}
};

var run = function(){
	WoW.guildInfos(function(data) {
		var news = data.news;
		console.log(news.length + ' news found');
		_.forEach(news, function(item){
			neCache.findNews(item, function(docs){
				if(docs.length == 0){
					neCache.saveNews(item);
					buildNewsMessage(item,function(message){
						slack.notify(message);
					});
				}
			});
		});
	});
};

var runCharacter = function(character){
	neCache.findForCharacter(character, function(docs){
		console.log(docs.length);
		if(docs && docs.length > 0){
			_.forEach(docs, function(doc){
				buildNewsMessageLight(doc,function(message){
					slack.notify(message);
				});
			});
		}
	});
};

router.get('/', function(req, res, next){
	var username = req.query.text;
	if(username != undefined){
		runCharacter(username);
	}
	else{
		run();
	}

	res.send('Ok');
});

module.exports = router;
