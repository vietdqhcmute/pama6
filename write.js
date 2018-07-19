// First, put things into "adsid_pama6" table!
//  If it success, means things NOT EXIST then put things into all_pama6 with total:1 unique:1
//       If putting not success means things EXIST, then UPDATE all_pama6 with total++ and unique++

// If putting into "adsid_pama6" not success means userID has Interact before
//     then put in table "all_pama6" with total:1 unique:1
//         If putting not success, then update it with total++ unique:+0

"use strict";
const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

module.exports.write = (event, context, callback) => {
  const data = JSON.parse(event.body);
  const date = new Date();
  const parseDate =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  const newID =
    data.from.link +
    "//" +
    data.from.bundleID +
    "//" +
    data.to.bundleID +
    "//" +
    parseDate.toString() +
    "//" +
    data.interact;

  var updateAll = function() {
    //this shit will return a Promise
    //just push things into ads table
    return new Promise(function(resolve, reject) {
      let param_ads = {
        TableName: "adsid_pama6",

        Item: {
          adsid: data.adsID + "//" + newID,
          link: data.from.link
        },

        ExpressionAttributeNames: {
          "#Link": "link"
        },
        ExpressionAttributeValues: {
          ":valLink": data.from.link,
          ":valID": data.adsID + "//" + newID
        },
        ConditionExpression: "adsid <> :valID AND #Link <> :valLink"
        //Avoid overwrite
      };
      docClient.put(param_ads, function(error) {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  updateAll()
    .then(function() {
      //put "adsid" SUCCESS
      //then put table "pamaAll_6" total++ unique++
      let param_put_success = {
        TableName: "all_pama6",
        Item: {
          jid: newID,
          link: data.from.link,
          date_cre: parseDate.toString(),
          interact: data.interact,
          from: data.from.bundleID,
          to: data.to.bundleID,
          total: 1,
          unique: 1
        },

        ExpressionAttributeValues: {
          ":valjid": newID,
          ":valDateCre": parseDate.toString()
        },
        ConditionExpression: "jid <> :valjid AND date_cre <> :valDateCre"
        //Avoid overwrite
      };
      docClient.put(param_put_success, error => {
        if (error) {
          //if Item already exist then update total++ unique++
          let param_up = {
            TableName: "all_pama6",

            Key: {
              jid: newID,
              date_cre: parseDate.toString()
            },
            ExpressionAttributeValues: {
              ":valInc": 1
            },
            ExpressionAttributeNames: {
              "#Total": "total",
              "#Unique": "unique"
            },
            UpdateExpression:
              "SET #Total=#Total + :valInc, #Unique=#Unique +:valInc",
            ReturnValues: "NONE"
          };
          docClient.update(param_up, error => {
            if (error) {
              callback(error);
            } else {
              callback(null);
            }
          });
        } else {
          //if Items not exist then put it (put it before)
          callback(null);
        }
      });
    })
    .catch(function(error) {
      //put adsid NOT SUCCES
      //put all_pama6 total 1 unique 1
      let param = {
        TableName: "all_pama6",
        Item: {
          jid: newID,
          link: data.from.link,
          date_cre: parseDate.toString(),
          interact: data.interact,
          from: data.from.bundleID,
          to: data.to.bundleID,
          total: 1,
          unique: 1
        },
        ExpressionAttributeValues: {
          ":valjid": newID,
          ":valDateCre": parseDate.toString()
        },
        ConditionExpression: "jid <> :valjid AND date_cre <> :valDateCre"
        //Avoid overwrite
      };

      docClient.put(param, error => {
        if (error) {
          //if items exist then update it with total ++ unique +0
          let param_up = {
            TableName: "all_pama6",

            Key: {
              jid: newID,
              date_cre: parseDate.toString()
            },
            ExpressionAttributeValues: {
              ":valInc": 1
            },
            ExpressionAttributeNames: {
              "#Total": "total"
            },
            UpdateExpression: "SET #Total=#Total + :valInc",
            ReturnValues: "NONE"
          };
          docClient.update(param_up, error => {
            if (error) {
              callback(error);
            } else {
              callback(null);
            }
          });
        } else {
          callback(null);
        }
      });
    });
};
