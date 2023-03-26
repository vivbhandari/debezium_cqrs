const Kafka = require('kafka-node');
const MongoClient = require('mongodb').MongoClient;

const url = 'mongodb://root:root@mongo:27017/admin';
const mongoDbName = 'inventory';
const collectionName = process.env.COLLECTION_NAME;
let database;
connectToMongo();

const kafkaHost = process.env.KAFKA_HOST || 'kafka:9092';
const topics = process.env.TOPICS.split(',');
const consumerTopicList = topics.map(topic => Object.assign({ 'topic': topic, 'partition': 0 }));
const opMap = {'c': 'Insert', 'r': 'Insert', 'u': 'Update', 'd': 'Delete'};
const client = new Kafka.KafkaClient({kafkaHost: kafkaHost});

waitForTopicAndCreateConsumer();

function connectToMongo(){
    MongoClient.connect(url, (err, db)=>{
        if (err){
            console.log('error connecting to mongodb');
            setTimeout(() => {
                console.log('retyring...');
                connectToMongo();
            }, 3000);
        } else {
            console.log('connected to mongodb');
            db.db('admin').addUser('myuser', 'password',{'roles':[{'role':'readWrite', 'db':mongoDbName}]}, (err, res)=>{
                if(err){
                    if(err.codeName === 'Location51003') console.log('user exist');
                    else throw err;
                }else console.log('user added!');
                database = db.db(mongoDbName);
                database.createCollection(collectionName, (err, res)=>{
                    if (err){
                      if (err.codeName === 'NamespaceExists') console.log('collection exist');
                      else throw err;
                    }
                    else console.log('collection initialized');
                });
            });
        }
      });
}

function waitForTopicAndCreateConsumer(){
    client.topicExists(topics, (err) => {
        if (err){
            console.log('kafka topics not created yet');
            setTimeout(() => {
                console.log('waiting...');
                waitForTopicAndCreateConsumer();
            }, 3000);
        }
        else {
            createConsumer();
        }
    });
}

function createConsumer(){
    const consumer = new Kafka.Consumer(
        client,
        consumerTopicList,
        { autoCommit: true }
    );

    consumer.on('message', (message) => {
        if (!message.value) return;
        const valueJson = JSON.parse(message.value);
        const {db, schema, table} = valueJson.payload.source;
        console.log(`db: ${db} \nschema: ${schema} \ntable: ${table}`);

        const keyJson = JSON.parse(message.key);
        console.log(`id: ${keyJson.payload.id}`);

        const {op: operation, before: existingValue, after: latestValue} = valueJson.payload;
        console.log(`operation: ${opMap[operation]}`);
        console.log(`existing document: ${JSON.stringify(existingValue, undefined, 4)}`);
        console.log(`latest document: ${JSON.stringify(latestValue, undefined, 4)}`);

        if(table === 'customers'){
            if(operation === 'c' || operation === 'r' ){
                database.collection(collectionName).insertOne(latestValue, (mErr, mRes)=>{
                    if (mErr) return console.log(mErr);
                });
            } else if (operation === 'u'){
                const query = {id: keyJson.payload.id};
                const value = {$set: latestValue};
                database.collection(collectionName).updateOne(query, value, (mErr, mRes)=>{
                    if (mErr) return console.log(mErr);
                });
            } else if (operation === 'd'){
                const query = {id: keyJson.payload.id};
                database.collection(collectionName).deleteOne(query, (mErr, mRes)=>{
                    if (mErr) return console.log(mErr);
                });
            }
        } else if (table === 'orders'){
            if(operation === 'c' || operation === 'r'){
                const query = {id: latestValue.purchaser};
                delete latestValue.purchaser;
                const value = { $addToSet: { orders: latestValue} };
                database.collection(collectionName).updateOne(query, value, (mErr, mRes)=>{
                    if (mErr) return console.log(mErr);
                });
            } else if(operation === 'u'){
                const query = {id: latestValue.purchaser};
                delete latestValue.purchaser;
                const options = { arrayFilters: [ {'element.id': latestValue.id}] };
                const value = { $set: { 'orders.$[element]': latestValue} };
                database.collection(collectionName).findOneAndUpdate(query, value, options, (mErr, mRes)=>{
                    if (mErr) return console.log(mErr);
                });
            } else if(operation === 'd'){
                const query = {id: existingValue.purchaser};
                const value = { $pull: {orders: {'id': existingValue.id}} };
                database.collection(collectionName).findOneAndUpdate(query, value, (mErr, mRes)=>{
                    if (mErr) return console.log(mErr);
                });
            }
        }
        console.log('-----------------------');
    });
    console.log('consumer started...');
}
