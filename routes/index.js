var express = require('express');
var _ = require('lodash');
var WoW = require('../wow.js');
var WoWCaracs = require('../wow-caracs.js');
var WoWInventory = require('../wow-inventory.js');
var Parameters = require('../parameters.js');
var router = express.Router();
var Slack = require('node-slackr');
var slack = new Slack(Parameters.Slack.hook,{
	username: "wow-bot"
});
var neCache = require ("../ne-cache.js");

var buildNewsMessage = function(item, callback){
	if(item.type === 'itemLoot'){
		WoW.itemInfos(item.itemId, function(itemData){
			var fields = [
				{
					title: 'Item Level',
					value: itemData.itemLevel,
					short:true
				}
			];
			if(itemData.inventoryType){
				var fullType = WoWInventory.inventoryTypes[''+itemData.inventoryType];
				if(fullType){
					fields.push({title:"Emplacement",value:fullType,short:true});
				}
			}
			var primaries = WoWCaracs.Primaries(itemData.bonusStats);
			if(primaries && primaries.length > 0){
				var v = "";
				_.forEach(primaries,function(stat){
					var name = WoWCaracs.Name(stat.stat);
					if(name){
						v += name + " : "+stat.amount+"\n";
					}
				});
				fields.push({title : "Primaires", value: v, short:true});
			}
			var secondaries = WoWCaracs.Secondaries(itemData.bonusStats);
			if(secondaries && secondaries.length > 0){
				var v = "";
				_.forEach(secondaries,function(stat){
					var name = WoWCaracs.Name(stat.stat);
					if(name){
						v += name + " : "+stat.amount+"\n";
					}
				});
				fields.push({title : "Secondaires", value: v, short:true});
			}
			var message = {
				channel: '#loot',
				attachments:[
					{
						fallback:item.character + ' a loot ' + itemData.name + ' (iLvL '+itemData.itemLevel+')',
						pretext:item.character,
						title:itemData.name,
						title_link:'http://fr.wowhead.com/item='+item.itemId,
						thumb_url: WoW.itemIconUrl(itemData.icon),
						color: WoW.itemColor(itemData.quality),
						fields:fields
					}
				]
			};
			callback(message);
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

router.get('/', function(req, res, next){
	run();
	res.send('Ok');
});

module.exports = router;
