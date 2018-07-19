'use strict';
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

module.exports.query = (event, context, callback) => {
	const data = JSON.parse(event.body);
	const mFromDate = data.fromDate;
	const mToDate = data.toDate;
	const arrInteract = [ { Impression: 0 }, { Click: 1 } ];
	//Get seperate date input
	//FIXME: this get Date is simply to test, lack of lots of things
	let arrDate = [];
	for (let i = mFromDate; i <= mToDate; i++) {
		arrDate.push(i);
	}

	let GetInteract = function(InteractName, interact, linkInput, dateInput, fromID, toID) {
		return new Promise((resolve, reject) => {
			let param_get = {
				TableName: 'all_pama6',
				Key: {
					jid:
						linkInput +
						'//' +
						fromID +
						'//' +
						toID +
						'//' +
						dateInput.toString() +
						'//' +
						interact.toString(),
					date_cre: dateInput.toString()
				},
				ExpressionAttributeNames: {
					'#Total': 'total',
					'#Unique': 'unique'
				},
				ProjectionExpression: '#Total,#Unique'
			};
			docClient.get(param_get, (error, result) => {
				if (error) {
					reject(error);
				} else {
					let obj = {};
					obj[InteractName] = result.Item;
					//Create Object and wrap it
					resolve(obj);
				}
			});
		});
	}; //--> return an Impression={total:3, unique:1} or Click={total:4, unique:4}
	let GetALLInteract = function(linkInput, dateInput, fromID, toID) {
		var promise = [];
		arrInteract.forEach((element) => {
			promise.push(
				GetInteract(Object.keys(element)[0], Object.values(element)[0], linkInput, dateInput, fromID, toID)
			);
		});

		return Promise.all(promise)
			.then((interact) => {
				//    interact= [{ Impression: { total: 4, unique: 2 } }, { Click: { total: 3, unique: 2 } }] is array

				let obj = {};
				obj[Object.keys(interact[0])] = Object.values(interact[0])[0];
				obj[Object.keys(interact[1])] = Object.values(interact[1])[0];
				let returnObject = {};
				returnObject[linkInput] = obj;
				return returnObject;
				// returnObject={ 'https://amanotes.slack.com': { Impression: { total: 4, unique: 2 },
				//                                                  Click: { total: 3, unique: 2 } } }
			})
			.catch((error) => {
				console.log(error);
				//callback(error);
			});
	}; //--> return Interact={Imrpression:{total,unique}, Click:{total,unique}}
	//
	let GetLinkinDate = function(dateInput, fromID, toID) {
		return new Promise((resolve, reject) => {
			let param_query = {
				TableName: 'all_pama6',
				IndexName: 'date_cre-interact-index-copy',
				ExpressionAttributeValues: {
					':valFrom': fromID,
					':valTo': toID,
					':valDate': dateInput.toString(),
					':valInteract': 0 //Always Impression, Click just an option
				},
				ExpressionAttributeNames: {
					'#From': 'from',
					'#To': 'to'
				},
				KeyConditionExpression: 'date_cre = :valDate AND interact = :valInteract',
				FilterExpression: '#From = :valFrom AND #To = :valTo',
				ProjectionExpression: 'link'
			};
			docClient.query(param_query, (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result.Items);
				}
			});
		});
	};//--> querry Date, return result of unique Links in that Date
	//
	let ExecuteGetLink = function(inputDate, fromID, toID) {
		return GetLinkinDate(inputDate, fromID, toID)
			.then((arraylink) => {
				var promise = [];
				arraylink.forEach((element) => {
					promise.push(GetALLInteract(element.link, inputDate, fromID, toID)); 
				});
				return Promise.all(promise).then((arrayResult) => {
					//arrayResult=[ { 'https://docs.aws.amazon.com': { Impression: [Object], Click: [Object] } },{ 'https://amanotes.slack.com': { Impression: [Object], Click: [Object] } } ]

					if (Object.keys(arrayResult).length === 0) {
						// get rid of null Date after query Interact by Date
						return null;
					}
					let objDate = {};

					//Wrap object
					arrayResult.forEach((element) => {
						objDate[Object.keys(element)[0]] = Object.values(element)[0];
					});
					let obj = {};
					obj[inputDate] = objDate;

					return obj;
				});
			})
			.catch((error) => {
				console.log(error);
				//callback(error);
			});
	};//--> return Date={Link1:{Interact}, Link2:{Interact},...}
	//
	let ExecuteGetDateObject = function(arrDate, fromID, toID) {
		let promise = [];
		let obj = {};
		obj.fromID = fromID;
		obj.toID = toID;

		arrDate.forEach((element) => {
			promise.push(ExecuteGetLink(element, fromID, toID));
		});//--> Get an array object of Date={Link1:{Interact}, Link2:{Interact},...}

		Promise.all(promise).then((result) => {
			//result include NULL OBJECT
			for (var i = 0; i < result.length; i++) {
				//wrap Object and get rid of NULL object
				if (result[i] !== null) {
					obj[arrDate[i]] = Object.values(result[i])[0];
				}
			}
			let response = {
				statusCode: 200,
				body: JSON.stringify(obj)
			};
			callback(null, response);
		});
	};//--> return Object={fromID:"gameA",toID:"gameB", Date1:{}, Date2:{},...}

	ExecuteGetDateObject(arrDate, data.from.bundleID, data.to.bundleID);
};
