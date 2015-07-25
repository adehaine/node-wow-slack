var express = require('express');
var router = express.Router();
var neCache = require('../ne-cache.js');
var WoW = require('../wow.js');
var _ = require('lodash');

router.get('/', function(req, res, next){
    neCache.listCharacters(function(characters){
        res.send({characters: characters});
    });
});

router.get('/:character', function(req,res,next){
    neCache.findForCharacter(req.params.character, function(docs){
        if(docs && docs.length > 0){
            var prettyDocs = [];
            var finished = _.after(docs.length, function(){
                res.send({data: prettyDocs});
            });
            _.forEach(docs, function(doc){
                buildItemDetails(doc,function(itemDetail){
                    if(itemDetail !== null){
                        prettyDocs.push(itemDetail);
                    }
                    finished();
                });
            });

        }
        else{
            res.send({data:{}})
        }
    });
});

var buildItemDetails = function(item, callback){
    if(item.type === 'itemLoot'){
        WoW.itemInfos(item.itemId, true, function(itemData, sure){
            callback({
                name:itemData.name,
                id:item.itemId,
                ilvl:itemData.itemLevel,
                sure: sure,
                timestamp: item.timestamp,
                icon: WoW.itemIconUrl(itemData.icon)
            });
        });
    }
    else{
        callback(null);
    }
};

module.exports = router;